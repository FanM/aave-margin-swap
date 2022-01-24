//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IFlashLoanReceiver.sol";
import "./interfaces/ILendingPool.sol";
import "./interfaces/IWETHGateway.sol";
import "./AaveLeveragedSwapBase.sol";
import "./utils/PercentageMath.sol";
import "./utils/WadRayMath.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract AaveLeveragedSwapManager is
  AaveLeveragedSwapBase,
  IFlashLoanReceiver,
  ReentrancyGuard,
  Initializable
{
  using SafeERC20 for IERC20;
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using EnumerableMap for EnumerableMap.AddressToUintsMap;

  IWETHGateway WETH_GATEWAY;
  address NATIVE_TOKEN;

  function initialize(
    address _addressProvider,
    address _sushiRouter,
    address _wethGateway,
    address _nativeToken
  ) external initializer {
    super.initialize(_addressProvider, _sushiRouter);
    WETH_GATEWAY = IWETHGateway(_wethGateway);
    NATIVE_TOKEN = _nativeToken;
  }

  /**
   * @dev execute a leveraged swap. If fee wasn't sent in, it will be deducted from collaterals
   * @param _targetToken The token that will be borrowed
   * @param _targetAmount The amount of the token
   * @param _pairToken The token that will be swapped to and deposited
   * @param _rateMode The interest rate mode of the debt the user wants to repay: 1 for Stable, 2 for Variable
   * @param _slippage The max slippage allowed during swap
   */
  function swapPreapprovedAssets(
    TokenInfo memory _targetToken,
    uint _targetAmount,
    TokenInfo memory _pairToken,
    uint _rateMode,
    uint _slippage
  ) external payable override nonReentrant {
    vars.user = msg.sender;
    vars.targetToken = _targetToken;
    vars.pairToken = _pairToken;
    vars.borrowRateMode = _rateMode;
    vars.slippage = _slippage;

    SwapVars memory swapVars = checkAndCalculateSwapVars(
      _targetToken,
      _targetAmount,
      _pairToken
    );

    uint pairTokenLtv = _pairToken.ltv;
    uint flashLoanETH = swapVars.flashLoanETH;
    vars.loanETH = swapVars.loanETH;
    vars.feeETH = swapVars.feeETH;

    // max loanable after depositing back
    uint maxLoanETH = (swapVars.maxLoanETH - swapVars.existDebtETH).percentDiv(
      PercentageMath.PERCENTAGE_FACTOR - pairTokenLtv
    );

    // calculate the amount we need to flash loan in pairToken
    vars.pairTokenAmount = convertEthToTokenAmount(
      flashLoanETH,
      vars.pairToken
    );

    uint loanWithSlippage;
    if (msg.value > 0) {
      // use the native token sent to pay the fees
      _ensureValueSentCanCoverFees(msg.value);
      loanWithSlippage = vars.loanETH.percentDiv(
        PercentageMath.PERCENTAGE_FACTOR - _slippage
      );
    } else {
      // use collateral to pay for fees
      loanWithSlippage = (vars.loanETH + vars.feeETH).percentDiv(
        PercentageMath.PERCENTAGE_FACTOR - _slippage
      );
    }
    // verify that the total cossts are less than max loanable
    require(
      loanWithSlippage <= maxLoanETH,
      "The provided collateral is not enough to cover loan and/or fees & slippage."
    );

    vars.targetTokenAmount = convertEthToTokenAmount(
      loanWithSlippage,
      vars.targetToken
    );

    _doFlashLoan(_pairToken.tokenAddress, vars.pairTokenAmount);

    cleanUpAfterSwap();
  }

  /**
   * @dev deleverage caller's debt position by repaying debt from collaterals. If fee wasn't sent in, it will be deducted from collaterals
   * @param _collaterals The list of collaterals in caller's portfolio
   * @param _collateralAmounts The list of collateral amounts that will be reduced
   * @param _targetToken The token that will be repayed
   * @param _targetAmount The amount of token that will be repayed
   * @param _rateMode The interest rate mode of the debt the user wants to repay: 1 for Stable, 2 for Variable
   * @param _slippage The max slippage allowed during swap
   */
  function repayDebt(
    address[] calldata _collaterals,
    uint256[] calldata _collateralAmounts,
    TokenInfo memory _targetToken,
    uint _targetAmount,
    uint _rateMode,
    uint _slippage
  ) external payable override nonReentrant {
    // Intuitively, deleveraging can be realized by withdrawing user's collaterals
    // and repaying her debt positions. However, Aave protocol doesn't allow
    // contract to withdraw on behalf of user. So our strategy still relies on
    // using flash loan to pay down user's debt, then transferring her aTokens
    // to contract for repaying the loan.
    vars.user = msg.sender;
    vars.targetToken = _targetToken;
    vars.targetTokenAmount = _targetAmount;
    vars.borrowRateMode = _rateMode;
    vars.slippage = _slippage;

    // calcuate how much collaterals we can reduce
    RepayVars memory repayVars = checkAndCalculateRepayVars(
      _collaterals,
      _collateralAmounts,
      _targetToken,
      _targetAmount,
      _rateMode,
      _slippage
    );

    uint collateralReducedETH = repayVars.totalCollateralReducedETH;
    uint[] memory reducedCollateralValues = repayVars.reducedCollateralValues;
    vars.feeETH = repayVars.feeETH;

    // make sure we have a clean map
    assert(assetMap.length() == 0);
    for (uint i = 0; i < _collaterals.length; i++) {
      uint[2] memory values = [
        _collateralAmounts[i],
        reducedCollateralValues[i]
      ];
      require(
        assetMap.set(_collaterals[i], values),
        "Duplicate entry is not allowed in the asset list."
      );
    }

    if (msg.value > 0) {
      // use the native token sent to pay the fees
      // we need to convert it to WETH and deposit to this contract
      // and the loan is less than max loanable
      _ensureValueSentCanCoverFees(msg.value);
      require(
        collateralReducedETH - repayVars.flashLoanETH >= 0,
        "The reduced collateral is not enough to cover repaid debt."
      );
    } else {
      // user uses collateral to pay for fees, verify that
      // the difference of reduced collateral and repaid debt can cover the fees.
      require(
        collateralReducedETH - repayVars.flashLoanETH >= vars.feeETH,
        "The reduced collateral is not enough to cover fees."
      );
    }

    _doFlashLoan(_targetToken.tokenAddress, _targetAmount);

    cleanUpAfterSwap();
  }

  /**
   * This function is called after your contract has received the flash loaned amount.
   * So it allows reentrancy by design. You need to make sure the LendingPool calling
   * it behave faithfully.
   */
  function executeOperation(
    address[] calldata _assets,
    uint256[] calldata _amounts,
    uint256[] calldata _premiums,
    address _initiator,
    bytes calldata // params
  ) external override onlyLendingPool returns (bool) {
    // make sure this function is indeed called by the lending pool with
    // correct arguments.
    assert(_assets.length == 1 && _initiator == address(this));
    if (_assets[0] == vars.pairToken.tokenAddress) {
      assert(_amounts[0] == vars.pairTokenAmount);
      return _handleLeverage(vars.pairToken, _amounts[0], _premiums[0]);
    } else {
      assert(
        _assets[0] == vars.targetToken.tokenAddress &&
          _amounts[0] == vars.targetTokenAmount
      );
      return _handleDeleverage(_assets[0], _amounts[0], _premiums[0]);
    }
  }

  fallback() external {
    revert("Fallback not allowed");
  }

  function _ensureValueSentCanCoverFees(uint _value) private {
    // convert the native token to WETH
    uint wethAmount = PRICE_ORACLE.getAssetPrice(NATIVE_TOKEN).wadMul(_value);
    // factor in the swap slippage and
    // verify that its value is enough to cover the fees
    require(
      wethAmount >=
        vars.feeETH.percentDiv(
          PercentageMath.PERCENTAGE_FACTOR - vars.slippage
        ),
      "The provided WETH is not enough to cover fees."
    );
    // deposit to this contract
    WETH_GATEWAY.depositETH{value: wethAmount}(
      address(LENDING_POOL),
      address(this), /*onBehalfOf*/
      0 /*referralCode*/
    );
    vars.wethTokenAmount = wethAmount;
  }

  function _doFlashLoan(address _asset, uint _amount) private {
    address[] memory flashLoanAssets = new address[](1);
    flashLoanAssets[0] = _asset;
    uint[] memory flashLoanAmounts = new uint[](1);
    flashLoanAmounts[0] = _amount;
    uint[] memory flashLoanModes = new uint[](1);
    flashLoanModes[0] = 0; // 0 = no debt
    LENDING_POOL.flashLoan(
      address(this), // receiverAddress
      flashLoanAssets,
      flashLoanAmounts,
      flashLoanModes,
      address(this), // onBehalfOf
      bytes(""), // params
      0 // referralCode
    );
  }

  function _handleLeverage(
    TokenInfo memory _asset,
    uint _amount,
    uint _premium
  ) private returns (bool) {
    // deposit the flash loan to increase user's collateral
    IERC20(_asset.tokenAddress).safeApprove(
      address(LENDING_POOL),
      _amount.wadToDecimals(_asset.decimals)
    );
    LENDING_POOL.deposit(
      _asset.tokenAddress,
      _amount,
      vars.user, /*onBehalfOf*/
      0 /*referralCode*/
    );

    // borrow targetToken and send the amount to this contract,
    // with the debt being incurred by user.
    // user have to delegate vars.targetTokenAmount of targetToken credit
    // to this contract in advance
    LENDING_POOL.borrow(
      vars.targetToken.tokenAddress,
      vars.targetTokenAmount,
      vars.borrowRateMode,
      0, /*referralCode*/
      vars.user /*debt incurred to*/
    );

    uint pairTokenAmount;
    if (vars.wethTokenAmount > 0) {
      // user uses wethToken to cover the fees
      // swap the borrowed targetToken to pay for flash loan
      pairTokenAmount = approveAndSwapExactTokensForTokens(
        vars.targetToken,
        vars.targetTokenAmount,
        vars.pairToken,
        convertEthToTokenAmount(vars.loanETH, vars.pairToken),
        address(this) /*onBehalfOf*/
      );
      // swap wethToken to pay fees
      uint pairTokenAmountForFee = approveAndSwapExactTokensForTokens(
        getTokenInfo(WETH_GATEWAY.getWETHAddress()),
        vars.wethTokenAmount,
        vars.pairToken,
        convertEthToTokenAmount(vars.feeETH, vars.pairToken),
        address(this) /*onBehalfOf*/
      );

      pairTokenAmount = pairTokenAmount + pairTokenAmountForFee;
    } else {
      // user uses collateral to pay for fees
      // swap the borrowed targetToken to pay for flash loan and fees
      pairTokenAmount = approveAndSwapExactTokensForTokens(
        vars.targetToken,
        vars.targetTokenAmount,
        vars.pairToken,
        convertEthToTokenAmount(vars.loanETH + vars.feeETH, vars.pairToken),
        address(this) /*onBehalfOf*/
      );
    }

    // The pairToken this contract have so far should be enough to repay the flash loan
    uint amountOwing = _amount + _premium;
    uint remainPairTokenAmount = pairTokenAmount - amountOwing;

    assert(remainPairTokenAmount >= 0);
    // Approve the LendingPool contract allowance to *pull* the owed amount
    IERC20(_asset.tokenAddress).safeApprove(
      address(LENDING_POOL),
      amountOwing.wadToDecimals(_asset.decimals)
    );

    // transfer the remaining pairToken to the user's account if there is any
    IERC20(_asset.tokenAddress).safeTransfer(
      vars.user,
      remainPairTokenAmount.wadToDecimals(_asset.decimals)
    );

    return true;
  }

  function _handleDeleverage(
    address _targetToken,
    uint _targetAmount,
    uint _premium
  ) private returns (bool) {
    // repays the user's debt with the flash loaned targetToken
    LENDING_POOL.repay(
      _targetToken,
      _targetAmount,
      vars.borrowRateMode,
      vars.user /*onBehalfOf*/
    );

    uint targetTokenAmountConverted;
    uint targetTokenAmountOut;
    // depends on caller to check there's no duplicate entries
    for (uint i = 0; i < assetMap.length(); i++) {
      (address asset, uint[2] memory values) = assetMap.at(i);
      TokenInfo memory assetInfo = getTokenInfo(asset);

      // transfer aToken to this contract for withdraw
      transferUserATokenToContract(
        assetInfo,
        values[0], /*asset amount*/
        vars.user
      );

      // withdraw the asset to this contract
      LENDING_POOL.withdraw(
        asset,
        values[0],
        address(this) /*to address*/
      );

      // swap the asset to targetToken
      targetTokenAmountOut = approveAndSwapExactTokensForTokens(
        assetInfo,
        values[0],
        vars.targetToken,
        convertEthToTokenAmount(
          values[1], /*asset value ETH*/
          vars.targetToken
        ).percentMul(PercentageMath.PERCENTAGE_FACTOR - vars.slippage),
        address(this) /*onBehalfOf*/
      );
      targetTokenAmountConverted += targetTokenAmountOut;
    }

    if (vars.wethTokenAmount > 0) {
      // swap wethToken to pay fees
      targetTokenAmountOut = approveAndSwapExactTokensForTokens(
        getTokenInfo(WETH_GATEWAY.getWETHAddress()),
        vars.wethTokenAmount,
        vars.targetToken,
        convertEthToTokenAmount(vars.feeETH, vars.targetToken),
        address(this) /*onBehalfOf*/
      );
      targetTokenAmountConverted += targetTokenAmountOut;
    }

    uint amountOwing = _targetAmount + _premium;
    uint remainingTargetToken = targetTokenAmountConverted - amountOwing;
    assert(remainingTargetToken >= 0);
    // Approve the LendingPool contract allowance to *pull* the owed amount
    IERC20(_targetToken).safeApprove(address(LENDING_POOL), amountOwing);

    // transfer the remaining to user if there's any
    IERC20(_targetToken).safeTransfer(vars.user, remainingTargetToken);

    return true;
  }
}
