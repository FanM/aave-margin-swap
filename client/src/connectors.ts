import { InjectedConnector } from "@web3-react/injected-connector";
import { WalletConnectConnector } from "@web3-react/walletconnect-connector";

import { envObj } from "./env";

const RPC_URLS: { [chainId: number]: string } = {
  137: envObj["polygon"].rpcUrl,
  42: envObj["kovan"].rpcUrl,
  1: envObj["mainnet"].rpcUrl,
};

export const injected = new InjectedConnector({
  supportedChainIds: [137, 42, 1],
});

export const walletconnect = new WalletConnectConnector({
  rpc: RPC_URLS,
  chainId: 42,
  bridge: "https://bridge.walletconnect.org",
  qrcode: true,
});
