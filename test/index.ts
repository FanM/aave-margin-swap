import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import {
  LendingPoolAddressesProvider,
  SushiswapRouter,
  WethGateway,
  NativeToken,
  MaticToken,
  DaiToken,
  ProtocalDataProvider,
  WbtcToken,
  WethToken,
} from "../.env.mumbai.json";

import {
  AaveLeveragedSwapManager,
  IProtocolDataProvider,
  IProtocolDataProvider__factory,
  IVariableDebtToken__factory,
  ILendingPoolAddressesProvider__factory,
  ILendingPool,
  ILendingPool__factory,
} from "../typechain";

const WEI = BigInt(1e18);
const ONE_HUNDERED_PERCENT = BigInt(1e4);
const ABS_ERROR_ALLOWED = 1e2; // 0.01

let aaveManager: AaveLeveragedSwapManager;
let dataProvider: IProtocolDataProvider;
let lendingPool: ILendingPool;
let account: Signer;

before(async () => {
  const accounts = await ethers.getSigners();
  account = accounts[0];
  console.log(`${await account.getAddress()}: ${await account.getBalance()}`);

  const AaveLeveragedSwapManager = await ethers.getContractFactory(
    "AaveLeveragedSwapManager"
  );
  aaveManager = await AaveLeveragedSwapManager.deploy();

  await aaveManager.deployed();
  console.log("AaveLeveragedSwapManager deployed to:", aaveManager.address);

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
});

describe("AaveLeveragedSwapManager", function () {
  it("Should fail without asset delegation approvement", async function () {
    const weth = await aaveManager.getTokenInfo(WethToken);
    const dai = await aaveManager.getTokenInfo(DaiToken);
    expect(
      await aaveManager.swapPreapprovedAssets(
        weth,
        BigInt(2) * WEI,
        dai,
        2,
        500
      )
    ).to.throw(
      Error,
      "VM Exception while processing transaction: reverted with reason string '59'"
    );
    /*
    expect(await greeter.greet()).to.equal("Hello, world!");

    const setGreetingTx = await greeter.setGreeting("Hola, mundo!");

    // wait until the transaction is mined
    await setGreetingTx.wait();

    expect(await greeter.greet()).to.equal("Hola, mundo!");
    */
  });

  it("Should succeed swapping assets", async function () {
    const weth = await aaveManager.getTokenInfo(WethToken);
    const dai = await aaveManager.getTokenInfo(DaiToken);
    const slippage = BigInt(2000);
    const targetAmount = BigInt(2) * WEI;
    const swapVars = await aaveManager.checkAndCalculateSwapVars(
      weth,
      targetAmount,
      dai
    );
    console.log(swapVars);

    const healthFactor = calcuateHealthFactor(
      swapVars.flashLoanETH.toBigInt(),
      swapVars.totalCollateralETH.toBigInt(),
      dai.liquidationThreshold.toBigInt(),
      swapVars.currentLiquidationThreshold.toBigInt(),
      swapVars.loanETH.toBigInt(),
      swapVars.feeETH.toBigInt(),
      swapVars.existDebtETH.toBigInt(),
      slippage
    );
    console.log(`Estimated Health Factor: ${healthFactor}`);

    const wethAddrs = await dataProvider.getReserveTokensAddresses(WethToken);

    let wethVariableDebtToken = IVariableDebtToken__factory.connect(
      wethAddrs.variableDebtTokenAddress,
      account
    );
    await wethVariableDebtToken.approveDelegation(
      aaveManager.address,
      BigInt(5) * WEI
    );
    await aaveManager.swapPreapprovedAssets(
      weth,
      targetAmount,
      dai,
      2,
      slippage
    );
    const actualHealthFactor = (
      await lendingPool.getUserAccountData(await account.getAddress())
    ).healthFactor
      .mul(ONE_HUNDERED_PERCENT)
      .div(WEI);
    console.log("New Health Factor: ", actualHealthFactor);
    expect(actualHealthFactor.sub(healthFactor).abs()).to.lt(ABS_ERROR_ALLOWED);
  });

  function calcuateHealthFactor(
    flashLoanETH: bigint,
    totalCollateralETH: bigint,
    pairTokenLiq: bigint,
    currentLiquidationThreshold: bigint,
    loanETH: bigint,
    feeETH: bigint,
    existDebtETH: bigint,
    slippage: bigint
  ): number {
    const newCollateral =
      flashLoanETH * pairTokenLiq +
      totalCollateralETH * currentLiquidationThreshold;
    const newDebt =
      ((loanETH + feeETH) * ONE_HUNDERED_PERCENT) /
        (ONE_HUNDERED_PERCENT - slippage) +
      existDebtETH;
    return Number(newCollateral / newDebt);
  }
});
