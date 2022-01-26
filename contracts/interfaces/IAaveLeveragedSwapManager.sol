//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title The interface for AaveLeveragedSwapManager
 */
interface IAaveLeveragedSwapManager {
  struct TokenInfo {
    address tokenAddress;
    bool borrowable;
    bool collaterable;
    uint liquidationThreshold;
    uint ltv;
    uint decimals;
  }

  struct Position {
    string symbol;
    address token;
    uint aTokenBalance;
    uint stableDebt;
    uint variableDebt;
    uint principalStableDebt;
    uint scaledVariableDebt;
    bool usedAsCollateral;
  }

  /**
   * @dev Get the asset reserve position list for the caller
   * @return the list of user's asset positions
   */
  function getAssetPositions() external view returns (Position[] memory);

  /**
   * @dev execute a leveraged swap.
   * @param targetToken The token that will be borrowed
   * @param targetAmount The amount of the token in wei
   * @param pairToken The token that will be swapped to and deposited
   * @param rateMode The interest rate mode of the debt the user wants to repay: 1 for Stable, 2 for Variable
   * @param slippage The max slippage allowed during swap
   */
  function swapPreapprovedAssets(
    TokenInfo memory targetToken,
    uint targetAmount,
    TokenInfo memory pairToken,
    uint rateMode,
    uint slippage
  ) external payable;

  /**
   * @dev deleverage caller's debt position by repaying debt from collaterals
   * @param collaterals The list of collaterals in caller's portfolio
   * @param collateralAmounts The list of collateral amounts in wei that will be reduced
   * @param targetToken The token that will be repayed
   * @param targetAmount The amount of token in wei that will be repayed
   * @param rateMode The interest rate mode of the debt the user wants to repay: 1 for Stable, 2 for Variable
   * @param slippage The max slippage allowed during swap
   */
  function repayDebt(
    TokenInfo[] calldata collaterals,
    uint256[] calldata collateralAmounts,
    TokenInfo memory targetToken,
    uint targetAmount,
    uint rateMode,
    uint slippage
  ) external payable;
}
