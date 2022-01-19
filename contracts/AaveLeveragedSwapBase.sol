//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IAaveLeveragedSwapManager.sol";
import "./interfaces/ILendingPool.sol";
import "./interfaces/IProtocolDataProvider.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./utils/EnumerableMap.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

abstract contract AaveLeveragedSwapBase is IAaveLeveragedSwapManager {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using EnumerableMap for EnumerableMap.AddressToUintsMap;

  struct FlashLoanVars {
    uint targetTokenAmount;
    uint pairTokenAmount; // leverage only
    uint wethTokenAmount;
    uint loanETH;
    uint feeETH;
    uint slippage;
    uint borrowRateMode;
    address targetToken;
    address pairToken; // leverage only
    address user;
  }

  uint public constant ONE_HUNDERED_PERCENT = 10000; // Aave uses 1 to reprecent 0.01%
  uint public constant FLASH_LOAN_FEE_RATE = 9; // 0.09%

  ILendingPoolAddressesProvider ADDRESSES_PROVIDER;
  ILendingPool LENDING_POOL;
  IProtocolDataProvider DATA_PROVIDER;
  IPriceOracleGetter PRICE_ORACLE;
  IUniswapV2Router02 SUSHI_ROUTER;

  EnumerableMap.AddressToUintsMap assetMap; // tokens to tokenValueETH map
  FlashLoanVars vars;

  modifier onlyLendingPool() {
    require(
      msg.sender == address(LENDING_POOL),
      "Only lending pool can call this function."
    );
    _;
  }

  function initialize(
    ILendingPoolAddressesProvider _addressProvider,
    IProtocolDataProvider _dataProvider,
    IUniswapV2Router02 _sushiRouter
  ) public {
    ADDRESSES_PROVIDER = _addressProvider;
    LENDING_POOL = ILendingPool(_addressProvider.getLendingPool());
    DATA_PROVIDER = IProtocolDataProvider(_dataProvider);
    PRICE_ORACLE = IPriceOracleGetter(_addressProvider.getPriceOracle());
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
  function checkAndCalculateSwapVars()
    public
    view
    returns (
      uint loanETH,
      uint maxLoanETH,
      uint feeETH,
      uint pairTokenLiqRatio,
      uint existDebtETH,
      uint flashLoanETH
    )
  {
    TokenInfo memory pairTokenInfo = _getTokenInfo(vars.pairToken);
    // pairToken should be collaterable
    require(pairTokenInfo.collaterable, "pairToken is not collaterable.");
    pairTokenLiqRatio = pairTokenInfo.liquidationRatio;

    (maxLoanETH, existDebtETH) = _getMaxLoanAndDebt(vars.user);

    // targetToken should be borrowable
    require(
      _getTokenInfo(vars.targetToken).borrowable,
      "targetToken is not borrowable."
    );

    // calculate the amount in ETH we need to borrow for targetToken
    loanETH = PRICE_ORACLE.getAssetPrice(vars.targetToken).mul(
      vars.targetTokenAmount
    );

    flashLoanETH = divPct(
      mulPct(maxLoanETH - existDebtETH, pairTokenLiqRatio),
      ONE_HUNDERED_PERCENT.sub(pairTokenLiqRatio)
    );
    feeETH = mulPct(flashLoanETH, vars.slippage.add(FLASH_LOAN_FEE_RATE));
  }

  function checkAndCalculateRepayVars(
    address[] memory _assets,
    uint[] memory _amounts
  )
    public
    view
    returns (
      uint totalCollateralReducedETH,
      uint maxLoanETH,
      uint loanETH,
      uint existDebtETH,
      uint feeETH,
      uint[] memory reducedCollateralValues
    )
  {
    loanETH = _tryGetUserDebtPosition();
    (maxLoanETH, existDebtETH) = _getMaxLoanAndDebt(vars.user);

    require(
      _assets.length == _amounts.length,
      "Each asset must have an amount specified."
    );
    reducedCollateralValues = new uint[](_assets.length);
    // depends on caller to ensure no duplicate entries
    for (uint i = 0; i < _assets.length; i++) {
      (
        uint tokenValueETH,
        bool userUsedAsCollateralEnabled
      ) = _tryGetUserTokenETH(_assets[i], _amounts[i], vars.user);
      require(
        userUsedAsCollateralEnabled && _getTokenInfo(_assets[i]).collaterable,
        "Token is not allowed as collateral."
      );
      reducedCollateralValues[i] = tokenValueETH;
      totalCollateralReducedETH += tokenValueETH;
    }
    feeETH =
      mulPct(totalCollateralReducedETH, vars.slippage) +
      mulPct(loanETH, FLASH_LOAN_FEE_RATE);
  }

  function _tryGetUserTokenETH(
    address _token,
    uint _amount,
    address _user
  )
    private
    view
    returns (uint tokenValueETH, bool userUsedAsCollateralEnabled)
  {
    uint aTokenBalance;
    (aTokenBalance, , , , , , , , userUsedAsCollateralEnabled) = DATA_PROVIDER
      .getUserReserveData(_token, _user);
    require(
      aTokenBalance >= _amount,
      "The specified amount aToken is more than what you have."
    );
    tokenValueETH = PRICE_ORACLE.getAssetPrice(_token).mul(_amount);
  }

  function _tryGetUserDebtPosition() private view returns (uint) {
    (, uint stableDebt, uint variableDebt, , , , , , ) = DATA_PROVIDER
      .getUserReserveData(vars.targetToken, vars.user);
    if (vars.borrowRateMode == 1) {
      // stable debt
      require(
        vars.targetTokenAmount <= stableDebt,
        "debt amount exceeds the stable debt that needs to repay."
      );
    } else if (vars.borrowRateMode == 2) {
      // variable debt
      require(
        vars.targetTokenAmount <= variableDebt,
        "debt amount exceeds the variable debt that needs to repay."
      );
    } else {
      revert("Invalid borrow rate mode!");
    }
    return
      PRICE_ORACLE.getAssetPrice(vars.targetToken).mul(vars.targetTokenAmount);
  }

  function _getMaxLoanAndDebt(address user)
    private
    view
    returns (uint maxLoan, uint debt)
  {
    (, uint userTotalDebtETH, uint userAvailableBorrowsETH, , , ) = LENDING_POOL
      .getUserAccountData(user);
    return (userTotalDebtETH + userAvailableBorrowsETH, userTotalDebtETH);
  }

  function _getTokenInfo(address token)
    private
    view
    returns (TokenInfo memory tokenInfo)
  {
    bool isActive;
    bool isFrozen;
    (
      ,
      ,
      tokenInfo.liquidationRatio,
      ,
      ,
      tokenInfo.collaterable,
      tokenInfo.borrowable,
      ,
      isActive,
      isFrozen
    ) = DATA_PROVIDER.getReserveConfigurationData(token);
    require(tokenInfo.liquidationRatio > 0, "Invalid token!");
    tokenInfo.collaterable = tokenInfo.collaterable && (isActive && !isFrozen);
    tokenInfo.borrowable = tokenInfo.borrowable && (isActive && !isFrozen);
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
    address _token,
    uint _amount,
    address _user
  ) internal {
    // get aToken address
    (address aTokenAddress, , ) = DATA_PROVIDER.getReserveTokensAddresses(
      _token
    );
    // user must have approved this contract to use their funds in advance
    require(
      IERC20(aTokenAddress).transferFrom(_user, address(this), _amount),
      "User did not approve contract to transfer aToken."
    );
  }

  function convertEthToTokenAmount(uint valueETH, address token)
    internal
    view
    returns (uint)
  {
    return valueETH.div(PRICE_ORACLE.getAssetPrice(token));
  }

  function mulPct(uint number, uint pct) internal pure returns (uint) {
    return number.mul(pct).div(ONE_HUNDERED_PERCENT);
  }

  function divPct(uint number, uint pct) internal pure returns (uint) {
    return number.mul(ONE_HUNDERED_PERCENT).div(pct);
  }

  function approveAndSwapExactTokensForTokens(
    address inToken,
    uint amountIn,
    address outToken,
    uint amountOutMin,
    address onBehalfOf
  ) internal returns (uint, uint) {
    IERC20(inToken).safeApprove(address(SUSHI_ROUTER), amountIn);

    uint[] memory amounts = SUSHI_ROUTER.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      _getSushiSwapTokenPath(inToken, outToken),
      onBehalfOf,
      block.timestamp
    );
    return (amounts[0], amounts[1]);
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
