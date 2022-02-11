// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import Web3 from "web3";
import { ethers } from "hardhat";
import {
  LendingPoolAddressesProvider,
  SushiswapRouter,
  NativeToken,
} from "../.env.kovan.json";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  const accounts = await ethers.getSigners();
  const adminAccount = accounts[0];
  // We get the contract to deploy
  const AaveLeveragedSwapManager = await ethers.getContractFactory(
    "AaveLeveragedSwapManager"
  );
  const aaveManagerImpl = await AaveLeveragedSwapManager.deploy();
  await aaveManagerImpl.deployed();
  console.log("AaveLeveragedSwapManager deployed to:", aaveManagerImpl.address);

  const web3 = new Web3();
  const initParams = web3.eth.abi.encodeFunctionCall(
    {
      name: "initialize",
      type: "function",
      inputs: [
        {
          type: "address",
          name: "_addressProvider",
        },
        {
          type: "address",
          name: "_sushiRouter",
        },
        {
          type: "address",
          name: "_nativeETH",
        },
      ],
    },
    [LendingPoolAddressesProvider, SushiswapRouter, NativeToken]
  );
  const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
  const proxy = await Proxy.deploy(
    aaveManagerImpl.address,
    await adminAccount.getAddress(),
    initParams
  );
  console.debug("Proxy deployed to:", proxy.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
