import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";
import Web3 from "web3";

import {
  LendingPoolAddressesProvider,
  SushiswapRouter,
  WethGateway,
  NativeToken,
  DaiToken,
  ProtocalDataProvider,
  WethToken,
} from "../.env.polygon.json";

import {
  AaveLeveragedSwapManager,
  IProtocolDataProvider,
  IProtocolDataProvider__factory,
  IVariableDebtToken__factory,
  ILendingPoolAddressesProvider__factory,
  IPriceOracleGetter__factory,
  IPriceOracleGetter,
  ILendingPool,
  ILendingPool__factory,
  IERC20__factory,
} from "../typechain";

const ABS_ERROR_ALLOWED = 1e15; // 0.001
const ONE_HUNDRED_PERCENT = BigInt(10000); // 100%
const SLIPPAGE = BigInt(200); // 2%
const LOAN_WETH_AMOUNT = BigInt(5) * BigInt(1e15);
const REPAY_WETH_AMOUNT = BigInt(4) * BigInt(1e15);
const RATE_MODE = 2;

type TokenInfo = [string, boolean, boolean, BigNumber, BigNumber, BigNumber] & {
  tokenAddress: string;
  borrowable: boolean;
  collaterable: boolean;
  liquidationThreshold: BigNumber;
  ltv: BigNumber;
  decimals: BigNumber;
};

type TokenAddresses = [string, string, string] & {
  aTokenAddress: string;
  stableDebtTokenAddress: string;
  variableDebtTokenAddress: string;
};

let aaveManager: AaveLeveragedSwapManager;
let dataProvider: IProtocolDataProvider;
let priceOracle: IPriceOracleGetter;
let lendingPool: ILendingPool;
let account: Signer;
let weth: TokenInfo;
let wethAddrs: TokenAddresses;
let dai: TokenInfo;
let daiAddrs: TokenAddresses;

before(async () => {
  const accounts = await ethers.getSigners();
  account = accounts[0];

  const AaveLeveragedSwapManager = await ethers.getContractFactory(
    "AaveLeveragedSwapManager"
  );
  aaveManager = await AaveLeveragedSwapManager.deploy();

  await aaveManager.deployed();
  console.debug("AaveLeveragedSwapManager deployed to:", aaveManager.address);

  await aaveManager.initialize(
    LendingPoolAddressesProvider,
    SushiswapRouter,
    WethGateway,
    NativeToken
  );

  const addressProvider = ILendingPoolAddressesProvider__factory.connect(
    LendingPoolAddressesProvider,
    account
  );
  dataProvider = IProtocolDataProvider__factory.connect(
    ProtocalDataProvider,
    account
  );
  lendingPool = ILendingPool__factory.connect(
    await addressProvider.getLendingPool(),
    account
  );
  priceOracle = IPriceOracleGetter__factory.connect(
    await addressProvider.getPriceOracle(),
    account
  );
  weth = await aaveManager.getTokenInfo(WethToken);
  wethAddrs = await dataProvider.getReserveTokensAddresses(WethToken);
  dai = await aaveManager.getTokenInfo(DaiToken);
  daiAddrs = await dataProvider.getReserveTokensAddresses(DaiToken);
});

describe("AaveLeveragedSwapManager", function () {
  async function getActualHealthFactor(): Promise<BigNumber> {
    return (await lendingPool.getUserAccountData(await account.getAddress()))
      .healthFactor;
  }

  it("Should fail without asset delegation approvement", async function () {
    expect(
      await aaveManager.swapPreapprovedAssets(
        weth,
        LOAN_WETH_AMOUNT,
        dai,
        RATE_MODE,
        500
      )
    ).to.throw(
      Error,
      "VM Exception while processing transaction: reverted with reason string '59'"
    );
  });

  it("Should succeed swapping assets", async function () {
    const swapVars = await aaveManager.checkAndCalculateSwapVars(
      weth,
      LOAN_WETH_AMOUNT,
      dai,
      SLIPPAGE,
      true
    );
    console.debug(swapVars);

    const healthFactor = swapVars.expectedHealthFactor.toBigInt();

    console.debug(`Expected Health Factor: ${healthFactor}`);

    let wethVariableDebtToken = IVariableDebtToken__factory.connect(
      wethAddrs.variableDebtTokenAddress,
      account
    );
    await wethVariableDebtToken.approveDelegation(
      aaveManager.address,
      LOAN_WETH_AMOUNT
    );
    const balanceBefore = await account.getBalance();
    await aaveManager.swapPreapprovedAssets(
      weth,
      LOAN_WETH_AMOUNT,
      dai,
      RATE_MODE,
      SLIPPAGE
    );

    console.debug(
      "Gas for swap: ",
      Web3.utils.fromWei(`${balanceBefore.sub(await account.getBalance())}`)
    );
    const actualHealthFactor = await getActualHealthFactor();
    console.debug(`Actual Health Factor: ${actualHealthFactor}`);
    expect(actualHealthFactor.sub(healthFactor).abs()).to.lt(ABS_ERROR_ALLOWED);
    expect((await aaveManager.vars()).pairTokenAmount).to.eq(0);
  });

  it("Should succeed repaying assets", async function () {
    const aDaiERCToken = IERC20__factory.connect(
      daiAddrs.aTokenAddress,
      account
    );
    let aDaiBalance = await aDaiERCToken.balanceOf(await account.getAddress());
    const assets = [dai];
    const amounts = [aDaiBalance];
    const repayVars = await aaveManager.checkAndCalculateRepayVars(
      assets,
      amounts,
      weth,
      REPAY_WETH_AMOUNT,
      RATE_MODE,
      SLIPPAGE,
      true
    );
    console.debug(repayVars);
    const healthFactor = repayVars.expectedHealthFactor.toBigInt();
    console.debug(`Expected Health Factor: ${healthFactor}`);

    await aDaiERCToken.approve(aaveManager.address, aDaiBalance);
    const balanceBefore = await account.getBalance();
    await aaveManager.repayDebt(
      assets,
      amounts,
      weth,
      REPAY_WETH_AMOUNT,
      RATE_MODE,
      SLIPPAGE
    );
    console.debug(
      "Gas for repay: ",
      Web3.utils.fromWei(`${balanceBefore.sub(await account.getBalance())}`)
    );
    const actualHealthFactor = await getActualHealthFactor();
    console.debug(`Actual Health Factor: ${actualHealthFactor}`);
    expect(actualHealthFactor.sub(healthFactor).abs()).to.lt(ABS_ERROR_ALLOWED);
    expect((await aaveManager.vars()).targetTokenAmount).to.eq(0);
  });

  it("Should succeed swapping assets with fees sent in", async function () {
    const swapVars = await aaveManager.checkAndCalculateSwapVars(
      weth,
      LOAN_WETH_AMOUNT,
      dai,
      SLIPPAGE,
      false // sends fee separately
    );
    console.debug(swapVars);

    const healthFactor = swapVars.expectedHealthFactor.toBigInt();

    console.debug(`Expected Health Factor: ${healthFactor}`);

    let wethVariableDebtToken = IVariableDebtToken__factory.connect(
      wethAddrs.variableDebtTokenAddress,
      account
    );
    await wethVariableDebtToken.approveDelegation(
      aaveManager.address,
      LOAN_WETH_AMOUNT
    );
    const feeAmount = swapVars.feeETH.div(
      await priceOracle.getAssetPrice(NativeToken)
    );
    const balanceBefore = await account.getBalance();
    await aaveManager.swapPreapprovedAssets(
      weth,
      LOAN_WETH_AMOUNT,
      dai,
      RATE_MODE,
      SLIPPAGE,
      {
        value: feeAmount // consider the slippage
          .mul(ONE_HUNDRED_PERCENT)
          .div(ONE_HUNDRED_PERCENT - SLIPPAGE),
      }
    );

    console.debug(
      "Gas for swap: ",
      Web3.utils.fromWei(`${balanceBefore.sub(await account.getBalance())}`)
    );
    const actualHealthFactor = await getActualHealthFactor();
    console.debug(`Actual Health Factor: ${actualHealthFactor}`);
    expect(actualHealthFactor.sub(healthFactor).abs()).to.lt(ABS_ERROR_ALLOWED);
    expect((await aaveManager.vars()).pairTokenAmount).to.eq(0);
  });

  it("Should succeed repaying assets with fees sent in", async function () {
    const aDaiERCToken = IERC20__factory.connect(
      daiAddrs.aTokenAddress,
      account
    );
    let aDaiBalance = await aDaiERCToken.balanceOf(await account.getAddress());
    const assets = [dai];
    const amounts = [aDaiBalance];
    const repayVars = await aaveManager.checkAndCalculateRepayVars(
      assets,
      amounts,
      weth,
      REPAY_WETH_AMOUNT,
      RATE_MODE,
      SLIPPAGE,
      false // sends fee separately
    );
    console.debug(repayVars);
    const healthFactor = repayVars.expectedHealthFactor.toBigInt();
    console.debug(`Expected Health Factor: ${healthFactor}`);

    await aDaiERCToken.approve(aaveManager.address, aDaiBalance);
    const feeAmount = repayVars.feeETH.div(
      await priceOracle.getAssetPrice(NativeToken)
    );
    const balanceBefore = await account.getBalance();
    await aaveManager.repayDebt(
      assets,
      amounts,
      weth,
      REPAY_WETH_AMOUNT,
      RATE_MODE,
      SLIPPAGE,
      {
        value: feeAmount // consider the slippage
          .mul(ONE_HUNDRED_PERCENT)
          .div(ONE_HUNDRED_PERCENT - SLIPPAGE),
      }
    );
    console.debug(
      "Gas for repay: ",
      Web3.utils.fromWei(`${balanceBefore.sub(await account.getBalance())}`)
    );
    const actualHealthFactor = await getActualHealthFactor();
    console.debug(`Actual Health Factor: ${actualHealthFactor}`);
    expect(actualHealthFactor.sub(healthFactor).abs()).to.lt(ABS_ERROR_ALLOWED);
    expect((await aaveManager.vars()).targetTokenAmount).to.eq(0);
  });
});
