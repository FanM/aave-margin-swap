import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  mocha: {
    timeout: 400000,
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      timeout: 1000000,
    },
    hardhat: {
      forking: {
        url:
          process.env.INFURA_API_KEY !== undefined
            ? `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`
            : "",
      },
      accounts:
        process.env.PRIVATE_KEY_1 !== undefined &&
        process.env.PRIVATE_KEY_2 !== undefined
          ? [
              {
                privateKey: process.env.PRIVATE_KEY_1!,
                balance: "100000000000000000000",
              },
              {
                privateKey: process.env.PRIVATE_KEY_2!,
                balance: "100000000000000000000",
              },
            ]
          : [],
    },
    kovan: {
      url: "https://kovan.poa.network",
      chainId: 42,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gas: 3000000,
    },
    polygon: {
      url: "https://polygon-rpc.com",
      chainId: 137,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gas: 3000000,
    },
    mumbai: {
      url: "https://rpc-mumbai.matic.today",
      chainId: 80001,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gas: 3000000,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    //apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
