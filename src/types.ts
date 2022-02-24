import { BigNumber } from "@ethersproject/bignumber";

export type AssetPosition = [
  string,
  string,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  boolean,
  boolean,
  boolean,
  boolean
] & {
  symbol: string;
  token: string;
  aTokenBalance: BigNumber;
  stableDebt: BigNumber;
  variableDebt: BigNumber;
  principalStableDebt: BigNumber;
  scaledVariableDebt: BigNumber;
  usedAsCollateral: boolean;
  borrowable: boolean;
  canBeCollateral: boolean;
  stableBorrowRateEnabled: boolean;
};

export type TokenInfo = [
  string,
  boolean,
  boolean,
  boolean,
  BigNumber,
  BigNumber,
  BigNumber
] & {
  tokenAddress: string;
  borrowable: boolean;
  canBeCollateral: boolean;
  stableBorrowRateEnabled: boolean;
  liquidationThreshold: BigNumber;
  ltv: BigNumber;
  decimals: BigNumber;
};

export type TokenAddresses = [string, string, string] & {
  aTokenAddress: string;
  stableDebtTokenAddress: string;
  variableDebtTokenAddress: string;
};

export type SwapVars = [
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber
] & {
  loanETH: BigNumber;
  maxLoanETH: BigNumber;
  feeETH: BigNumber;
  flashLoanETH: BigNumber;
  currentHealthFactor: BigNumber;
  expectedHealthFactor: BigNumber;
};

export type RepayVars = [
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber[]
] & {
  loanETH: BigNumber;
  feeETH: BigNumber;
  totalCollateralReducedETH: BigNumber;
  flashLoanETH: BigNumber;
  currentHealthFactor: BigNumber;
  expectedHealthFactor: BigNumber;
  reducedCollateralValues: BigNumber[];
};

export function tuple<T extends unknown[]>(...args: T): T {
  return args;
}
