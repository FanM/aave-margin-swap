//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IAaveLeveragedSwapManager.sol";
import "./interfaces/ILendingPool.sol";
import "./interfaces/IProtocolDataProvider.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./utils/EnumerableMap.sol";
import "./utils/PercentageMath.sol";
import "./utils/WadRayMath.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract AaveLeveragedSwapBase is IAaveLeveragedSwapManager {
  using SafeERC20 for IERC20;
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using EnumerableMap for EnumerableMap.AddressToUintsMap;

  struct FlashLoanVars {
    uint targetTokenAmount;
    uint pairTokenAmount; // leverage only
    uint wethTokenAmount;
    uint loanETH; // leverage only
    uint feeETH;
    uint slippage;
    uint borrowRateMode;
    TokenInfo targetToken;
    TokenInfo pairToken; // leverage only
    address user;
  }

  struct SwapVars {
    uint loanETH;
    uint maxLoanETH;
    uint feeETH;
    uint existDebtETH;
    uint flashLoanETH;
    uint currentHealthFactor;
    uint expectedHealthFactor;
  }

  struct RepayVars {
    uint loanETH;
    uint feeETH;
    uint existDebtETH;
    uint flashLoanETH;
    uint currentHealthFactor;
    uint expectedHealthFactor;
    uint[] reducedCollateralValues;
  }

  uint public constant FLASH_LOAN_FEE_RATE = 9; // 0.09%
  bytes32 public constant PROTOCOL_DATA_PROVIDER_ID = bytes32(uint(1)) << 248; // 0x01

  ILendingPoolAddressesProvider ADDRESSES_PROVIDER;
  ILendingPool LENDING_POOL;
  IProtocolDataProvider DATA_PROVIDER;
  IPriceOracleGetter PRICE_ORACLE;
  IUniswapV2Router02 SUSHI_ROUTER;

  EnumerableMap.AddressToUintsMap assetMap; // tokens to tokenValueETH map
  FlashLoanVars public vars;

  modifier onlyLendingPool() {
    require(
      msg.sender == address(LENDING_POOL),
      "Only lending pool can call this function."
    );
    _;
  }

  function initialize(address _addressProvider, address _sushiRouter) internal {
    ADDRESSES_PROVIDER = ILendingPoolAddressesProvider(_addressProvider);
    LENDING_POOL = ILendingPool(ADDRESSES_PROVIDER.getLendingPool());
    DATA_PROVIDER = IProtocolDataProvider(
      ADDRESSES_PROVIDER.getAddress(PROTOCOL_DATA_PROVIDER_ID)
    );
    PRICE_ORACLE = IPriceOracleGetter(ADDRESSES_PROVIDER.getPriceOracle());
    SUSHI_ROUTER = IUniswapV2Router02(_sushiRouter);
  }

  function getAssetPositions()
    external
    view
    override
    returns (Position[] memory positions)
  {
    IProtocolDataProvider.TokenData[] memory tokenList = DATA_PROVIDER
      .getAllReservesTokens();
    positions = new Position[](tokenList.length);
    for (uint i = 0; i < tokenList.length; i++) {
      (
        uint aTokenBalance,
        uint stableDebt,
        uint variableDebt,
        uint principalStableDebt,
        uint scaledVariableDebt,
        ,
        ,
        ,
        bool usedAsCollateral
      ) = DATA_PROVIDER.getUserReserveData(
          tokenList[i].tokenAddress,
          msg.sender
        );

      positions[i] = Position(
        tokenList[i].symbol,
        tokenList[i].tokenAddress,
        aTokenBalance,
        stableDebt,
        variableDebt,
        principalStableDebt,
        scaledVariableDebt,
        usedAsCollateral
      );
    }
  }

  /**
   * @dev calculate swap variables and do sanity check, the return values can help derive health factor
   */
  function checkAndCalculateSwapVars(
    TokenInfo memory _targetToken,
    uint _targetTokenAmount,
    TokenInfo memory _pairToken,
    uint _slippage,
    bool _feePaidByCollateral
  ) public view returns (SwapVars memory swapVars) {
    // pairToken should be collaterable
    require(_pairToken.collaterable, "pairToken is not collaterable.");
    uint totalCollateralETH;
    uint currentLiquidationThreshold;
    (
      totalCollateralETH,
      swapVars.maxLoanETH,
      swapVars.existDebtETH,
      currentLiquidationThreshold,
      swapVars.currentHealthFactor
    ) = _getMaxLoanAndDebt(msg.sender);

    // targetToken should be borrowable
    require(_targetToken.borrowable, "targetToken is not borrowable.");

    // calculate the amount in ETH we need to borrow for targetToken
    swapVars.loanETH = PRICE_ORACLE
      .getAssetPrice(_targetToken.tokenAddress)
      .wadMul(_targetTokenAmount);

    swapVars.flashLoanETH = swapVars.loanETH.percentMul(
      PercentageMath.PERCENTAGE_FACTOR - _slippage
    );

    if (_feePaidByCollateral)
      swapVars.flashLoanETH = swapVars.flashLoanETH.percentDiv(
        PercentageMath.PERCENTAGE_FACTOR + FLASH_LOAN_FEE_RATE
      );

    swapVars.feeETH = swapVars.flashLoanETH.percentMul(FLASH_LOAN_FEE_RATE);
    uint newCollateral = swapVars.flashLoanETH.percentMul(
      _pairToken.liquidationThreshold
    ) + totalCollateralETH.percentMul(currentLiquidationThreshold);
    uint newDebt = swapVars.existDebtETH + swapVars.loanETH;
    swapVars.expectedHealthFactor = newCollateral.wadDiv(newDebt);
  }

  function checkAndCalculateRepayVars(
    TokenInfo[] memory _assets,
    uint[] memory _amounts,
    TokenInfo memory _targetToken,
    uint _targetAmount,
    uint _rateMode,
    uint _slippage,
    bool _feePaidByCollateral
  ) public view returns (RepayVars memory repayVars) {
    repayVars.flashLoanETH = _tryGetUserDebtPosition(
      _targetToken,
      _targetAmount,
      _rateMode,
      msg.sender
    );
    uint totalCollateralETH;
    uint currentLiquidationThreshold;
    (
      totalCollateralETH,
      ,
      repayVars.existDebtETH,
      currentLiquidationThreshold,
      repayVars.currentHealthFactor
    ) = _getMaxLoanAndDebt(msg.sender);

    require(
      _assets.length == _amounts.length,
      "Each asset must have an amount specified."
    );
    repayVars.reducedCollateralValues = new uint[](_assets.length);

    totalCollateralETH = totalCollateralETH.percentMul(
      currentLiquidationThreshold
    );
    // depends on caller to ensure no duplicate entries
    uint totalCollateralReducedETH;
    for (uint i = 0; i < _assets.length; i++) {
      (
        uint tokenValueETH,
        bool userUsedAsCollateralEnabled
      ) = _tryGetUserTokenETH(_assets[i], _amounts[i], msg.sender);
      require(
        userUsedAsCollateralEnabled && _assets[i].collaterable,
        "Token is not allowed as collateral."
      );
      repayVars.reducedCollateralValues[i] = tokenValueETH;
      totalCollateralReducedETH += tokenValueETH;
      totalCollateralETH -= tokenValueETH.percentMul(
        _assets[i].liquidationThreshold
      );
    }
    repayVars.loanETH = (
      _feePaidByCollateral
        ? repayVars.flashLoanETH
        : repayVars.flashLoanETH + repayVars.feeETH
    ).percentDiv(PercentageMath.PERCENTAGE_FACTOR - _slippage);
    require(
      totalCollateralReducedETH >= repayVars.loanETH,
      "The reduced collateral is not enough to cover repaid debt and fee."
    );
    repayVars.feeETH = repayVars.flashLoanETH.percentMul(FLASH_LOAN_FEE_RATE);

    if (repayVars.existDebtETH <= repayVars.flashLoanETH) {
      // user's debt is cleared
      repayVars.expectedHealthFactor = type(uint).max;
    } else {
      unchecked {
        repayVars.expectedHealthFactor = totalCollateralETH.wadDiv(
          repayVars.existDebtETH - repayVars.flashLoanETH
        );
      }
    }
  }

  function getTokenInfo(address _token)
    public
    view
    returns (TokenInfo memory tokenInfo)
  {
    tokenInfo.tokenAddress = _token;
    bool isActive;
    bool isFrozen;
    (
      tokenInfo.decimals,
      tokenInfo.ltv,
      tokenInfo.liquidationThreshold,
      ,
      ,
      tokenInfo.collaterable,
      tokenInfo.borrowable,
      ,
      isActive,
      isFrozen
    ) = DATA_PROVIDER.getReserveConfigurationData(_token);
    tokenInfo.collaterable = tokenInfo.collaterable && (isActive && !isFrozen);
    tokenInfo.borrowable = tokenInfo.borrowable && (isActive && !isFrozen);
  }

  function _tryGetUserTokenETH(
    TokenInfo memory _token,
    uint _amount,
    address _user
  )
    private
    view
    returns (uint tokenValueETH, bool userUsedAsCollateralEnabled)
  {
    uint aTokenBalance;
    (aTokenBalance, , , , , , , , userUsedAsCollateralEnabled) = DATA_PROVIDER
      .getUserReserveData(_token.tokenAddress, _user);
    require(
      aTokenBalance >= _amount,
      "The specified amount aToken is more than what you have."
    );
    tokenValueETH = PRICE_ORACLE.getAssetPrice(_token.tokenAddress).wadMul(
      _amount
    );
  }

  function _tryGetUserDebtPosition(
    TokenInfo memory _targetToken,
    uint _targetTokenAmount,
    uint _borrowRateMode,
    address _user
  ) private view returns (uint) {
    (, uint stableDebt, uint variableDebt, , , , , , ) = DATA_PROVIDER
      .getUserReserveData(_targetToken.tokenAddress, _user);
    if (_borrowRateMode == 1) {
      // stable debt
      require(
        _targetTokenAmount <= stableDebt,
        "debt amount exceeds the stable debt that needs to repay."
      );
    } else if (_borrowRateMode == 2) {
      // variable debt
      require(
        _targetTokenAmount <= variableDebt,
        "debt amount exceeds the variable debt that needs to repay."
      );
    } else {
      revert("Invalid borrow rate mode!");
    }
    return
      PRICE_ORACLE.getAssetPrice(_targetToken.tokenAddress).wadMul(
        _targetTokenAmount
      );
  }

  function _getMaxLoanAndDebt(address user)
    private
    view
    returns (
      uint totalCollateral,
      uint maxLoan,
      uint debt,
      uint liquidationThreshold,
      uint healthFactor
    )
  {
    uint userAvailableBorrowsETH;
    (
      totalCollateral,
      debt,
      userAvailableBorrowsETH,
      liquidationThreshold,
      ,
      healthFactor
    ) = LENDING_POOL.getUserAccountData(user);
    maxLoan = debt + userAvailableBorrowsETH;
  }

  function _getSushiSwapTokenPath(address fromToken, address toToken)
    private
    pure
    returns (address[] memory path)
  {
    path = new address[](2);
    path[0] = fromToken;
    path[1] = toToken;

    return path;
  }

  function transferUserATokenToContract(
    TokenInfo memory _token,
    uint _amount,
    address _user
  ) internal {
    // get aToken address
    (address aTokenAddress, , ) = DATA_PROVIDER.getReserveTokensAddresses(
      _token.tokenAddress
    );
    // user must have approved this contract to use their funds in advance
    require(
      IERC20(aTokenAddress).transferFrom(
        _user,
        address(this),
        _amount.wadToDecimals(_token.decimals) // converts to token's decimals
      ),
      "User did not approve contract to transfer aToken."
    );
  }

  function convertEthToTokenAmount(uint valueETH, TokenInfo memory token)
    internal
    view
    returns (uint)
  {
    return valueETH.wadDiv(PRICE_ORACLE.getAssetPrice(token.tokenAddress));
  }

  function approveAndSwapExactTokensForTokens(
    TokenInfo memory inToken,
    uint amountIn, // wad
    TokenInfo memory outToken,
    uint amountOutMin, // wad
    address onBehalfOf
  ) internal returns (uint amountOut) {
    // converts wad to the token units
    amountIn = amountIn.wadToDecimals(inToken.decimals);
    amountOutMin = amountOutMin.wadToDecimals(outToken.decimals);
    IERC20(inToken.tokenAddress).safeApprove(address(SUSHI_ROUTER), amountIn);

    uint[] memory amounts = SUSHI_ROUTER.swapExactTokensForTokens(
      amountIn,
      1, //amountOutMin,
      _getSushiSwapTokenPath(inToken.tokenAddress, outToken.tokenAddress),
      onBehalfOf,
      block.timestamp
    );
    amountOut = amounts[1].decimalsToWad(outToken.decimals);
  }

  function cleanUpAfterSwap() internal {
    // reset vars
    delete vars;
    // clear the address map
    for (uint i = 0; i < assetMap.length(); i++) {
      (address key, ) = assetMap.at(i);
      assetMap.remove(key);
    }
  }
}
