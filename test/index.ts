import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";

import {
  LendingPoolAddressesProvider,
  ProtocalDataProvider,
  SushiswapRouter,
  NativeToken,
  DaiToken,
  WethToken,
  UsdtToken,
  AaveToken,
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
  IERC20,
} from "../typechain";

const WEI = BigInt(1e18);
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

type UserAccountData = [
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber
] & {
  totalCollateralETH: BigNumber;
  totalDebtETH: BigNumber;
  availableBorrowsETH: BigNumber;
  currentLiquidationThreshold: BigNumber;
  ltv: BigNumber;
  healthFactor: BigNumber;
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
let targetTokenInfo: TokenInfo;
let targetTokenAddrs: TokenAddresses;
let targetToken: IERC20;
let pairTokenInfo: TokenInfo;
let pairTokenAddrs: TokenAddresses;
let pairToken: IERC20;
let aPairToken: IERC20;

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
  // choose Weth and Dai as our token pair because they both have 18 decimals thus
  // easier to work with ERC20 APIs
  targetTokenInfo = await aaveManager.getTokenInfo(WethToken);
  targetTokenAddrs = await dataProvider.getReserveTokensAddresses(WethToken);
  targetToken = IERC20__factory.connect(WethToken, account);
  pairTokenInfo = await aaveManager.getTokenInfo(DaiToken);
  pairTokenAddrs = await dataProvider.getReserveTokensAddresses(DaiToken);
  pairToken = IERC20__factory.connect(DaiToken, account);
  aPairToken = IERC20__factory.connect(pairTokenAddrs.aTokenAddress, account);
});

describe("AaveLeveragedSwapManager", function () {
  async function getUserAccountData(): Promise<UserAccountData> {
    return await lendingPool.getUserAccountData(await account.getAddress());
  }
  it("Should fail if contract is initialized twice", async function () {
    await expect(
      aaveManager.initialize(
        LendingPoolAddressesProvider,
        SushiswapRouter,
        NativeToken
      )
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("Should fail without asset delegation approvement", async function () {
    await expect(
      aaveManager.swapPreapprovedAssets(
        targetTokenInfo,
        LOAN_WETH_AMOUNT,
        pairTokenInfo,
        RATE_MODE,
        500
      )
    ).to.be.revertedWith("E2");
  });

  it("Should fail if the pair token is not collaterable", async function () {
    const usdtTokenInfo = await aaveManager.getTokenInfo(UsdtToken);
    await expect(
      aaveManager.checkAndCalculateSwapVars(
        targetTokenInfo,
        LOAN_WETH_AMOUNT,
        usdtTokenInfo,
        SLIPPAGE,
        true
      )
    ).to.be.revertedWith("E3");
  });

  it("Should fail if the target token is not borrowable", async function () {
    const aaveTokenInfo = await aaveManager.getTokenInfo(AaveToken);
    await expect(
      aaveManager.checkAndCalculateSwapVars(
        aaveTokenInfo,
        LOAN_WETH_AMOUNT,
        pairTokenInfo,
        SLIPPAGE,
        true
      )
    ).to.be.revertedWith("E4");
  });

  it("Should succeed swapping assets", async function () {
    const swapVars = await aaveManager.checkAndCalculateSwapVars(
      targetTokenInfo,
      LOAN_WETH_AMOUNT,
      pairTokenInfo,
      SLIPPAGE,
      true
    );
    console.debug(swapVars);

    const healthFactor = swapVars.expectedHealthFactor.toBigInt();

    let wethVariableDebtToken = IVariableDebtToken__factory.connect(
      targetTokenAddrs.variableDebtTokenAddress,
      account
    );
    await wethVariableDebtToken.approveDelegation(
      aaveManager.address,
      LOAN_WETH_AMOUNT
    );
    const tx = await aaveManager.swapPreapprovedAssets(
      targetTokenInfo,
      LOAN_WETH_AMOUNT,
      pairTokenInfo,
      RATE_MODE,
      SLIPPAGE
    );

    const recept = await ethers.provider.getTransactionReceipt(tx.hash);
    console.debug(`Gas used: ${recept.gasUsed}`);
    const actualHealthFactor = (await getUserAccountData()).healthFactor;
    console.debug(`Actual Health Factor: ${actualHealthFactor}`);
    // verify the expected heath factor is within the error range
    expect(actualHealthFactor.sub(healthFactor).abs()).to.lt(ABS_ERROR_ALLOWED);
    // verify vars are cleared
    expect((await aaveManager.vars()).pairTokenAmount).to.eq(0);
    // verify aaveManager doesn't hold any pair tokens
    expect(await pairToken.balanceOf(aaveManager.address)).to.eq(0);
  });

  it("Should fail repaying if user did not approve aToken", async function () {
    let aPairTokenBalance = await aPairToken.balanceOf(
      await account.getAddress()
    );
    const assets = [pairTokenInfo];
    const amounts = [aPairTokenBalance];
    await expect(
      aaveManager.repayDebt(
        assets,
        amounts,
        targetTokenInfo,
        REPAY_WETH_AMOUNT,
        RATE_MODE,
        SLIPPAGE
      )
    ).to.be.revertedWith("E11");
  });

  it("Should succeed repaying partial debt", async function () {
    let aPairTokenBalance = await aPairToken.balanceOf(
      await account.getAddress()
    );
    const assets = [pairTokenInfo];
    const amounts = [aPairTokenBalance];
    const repayVars = await aaveManager.checkAndCalculateRepayVars(
      assets,
      amounts,
      targetTokenInfo,
      REPAY_WETH_AMOUNT,
      RATE_MODE,
      SLIPPAGE,
      true
    );
    console.debug(repayVars);
    const healthFactor = repayVars.expectedHealthFactor.toBigInt();

    await aPairToken.approve(aaveManager.address, aPairTokenBalance);
    const tx = await aaveManager.repayDebt(
      assets,
      amounts,
      targetTokenInfo,
      REPAY_WETH_AMOUNT,
      RATE_MODE,
      SLIPPAGE
    );

    const recept = await ethers.provider.getTransactionReceipt(tx.hash);
    console.debug(`Gas used: ${recept.gasUsed}`);
    const actualHealthFactor = (await getUserAccountData()).healthFactor;
    console.debug(`Actual Health Factor: ${actualHealthFactor}`);
    // verify the expected heath factor is within the error range
    expect(actualHealthFactor.sub(healthFactor).abs()).to.lt(ABS_ERROR_ALLOWED);
    // verify vars are cleared
    expect((await aaveManager.vars()).targetTokenAmount).to.eq(0);
    // verify aaveManager doesn't hold any target tokens
    expect(await targetToken.balanceOf(aaveManager.address)).to.eq(0);
  });

  it("Should succeed swapping assets with fees sent in", async function () {
    const swapVars = await aaveManager.checkAndCalculateSwapVars(
      targetTokenInfo,
      LOAN_WETH_AMOUNT,
      pairTokenInfo,
      SLIPPAGE,
      false // sends fee separately
    );
    console.debug(swapVars);

    const healthFactor = swapVars.expectedHealthFactor.toBigInt();

    let wethVariableDebtToken = IVariableDebtToken__factory.connect(
      targetTokenAddrs.variableDebtTokenAddress,
      account
    );
    await wethVariableDebtToken.approveDelegation(
      aaveManager.address,
      LOAN_WETH_AMOUNT
    );
    const feeAmount =
      (swapVars.feeETH.toBigInt() * WEI) /
      (await priceOracle.getAssetPrice(NativeToken)).toBigInt();
    const tx = await aaveManager.swapPreapprovedAssets(
      targetTokenInfo,
      LOAN_WETH_AMOUNT,
      pairTokenInfo,
      RATE_MODE,
      SLIPPAGE,
      {
        value:
          (feeAmount * // consider the slippage
            ONE_HUNDRED_PERCENT) /
          (ONE_HUNDRED_PERCENT - SLIPPAGE),
      }
    );

    const recept = await ethers.provider.getTransactionReceipt(tx.hash);
    console.debug(`Gas used: ${recept.gasUsed}`);
    const actualHealthFactor = (await getUserAccountData()).healthFactor;
    console.debug(`Actual Health Factor: ${actualHealthFactor}`);
    expect(actualHealthFactor.sub(healthFactor).abs()).to.lt(ABS_ERROR_ALLOWED);
    expect((await aaveManager.vars()).pairTokenAmount).to.eq(0);
  });

  it("Should succeed repaying total debt with fees sent in", async function () {
    const aTargetToken = IERC20__factory.connect(
      targetTokenAddrs.aTokenAddress,
      account
    );
    const aTargetTokenBalance = await aTargetToken.balanceOf(
      await account.getAddress()
    );

    const aPairTokenBalance = await aPairToken.balanceOf(
      await account.getAddress()
    );
    const assets = [pairTokenInfo, targetTokenInfo];
    const amounts = [aPairTokenBalance, aTargetTokenBalance];

    let wethVariableDebtToken = IERC20__factory.connect(
      targetTokenAddrs.variableDebtTokenAddress,
      account
    );
    const repaidAmount = await wethVariableDebtToken.balanceOf(
      await account.getAddress()
    );
    const repayVars = await aaveManager.checkAndCalculateRepayVars(
      assets,
      amounts,
      targetTokenInfo,
      repaidAmount,
      RATE_MODE,
      SLIPPAGE,
      false // sends fee separately
    );
    console.debug(repayVars);

    await aPairToken.approve(aaveManager.address, aPairTokenBalance);
    await aTargetToken.approve(aaveManager.address, aTargetTokenBalance);
    const feeAmount =
      (repayVars.feeETH.toBigInt() * WEI) /
      (await priceOracle.getAssetPrice(NativeToken)).toBigInt();
    const tx = await aaveManager.repayDebt(
      assets,
      amounts,
      targetTokenInfo,
      repaidAmount,
      RATE_MODE,
      SLIPPAGE,
      {
        value:
          (feeAmount * // consider the slippage
            ONE_HUNDRED_PERCENT) /
          (ONE_HUNDRED_PERCENT - SLIPPAGE),
      }
    );
    const recept = await ethers.provider.getTransactionReceipt(tx.hash);
    console.debug(`Gas used: ${recept.gasUsed}`);
    const debtAfterRepay = (await getUserAccountData()).totalDebtETH;
    console.debug(`Debt after repay: ${debtAfterRepay}`);
    expect((await aaveManager.vars()).targetTokenAmount).to.eq(0);
    // verify aaveManager doesn't hold any target tokens
    expect(await targetToken.balanceOf(aaveManager.address)).to.eq(0);
  });
});
