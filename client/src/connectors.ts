import { InjectedConnector } from "@web3-react/injected-connector";
import { WalletConnectConnector } from "@web3-react/walletconnect-connector";

const RPC_URLS: { [chainId: number]: string } = {
  137: process.env.REACT_APP_RPC_URL_137 as string,
  42: process.env.REACT_APP_RPC_URL_42 as string,
  31337: process.env.REACT_APP_RPC_URL_31337 as string,
};

export const injected = new InjectedConnector({
  supportedChainIds: [137, 42, 31337],
});

export const walletconnect = new WalletConnectConnector({
  rpc: RPC_URLS,
  chainId: 42,
  bridge: "https://bridge.walletconnect.org",
  qrcode: true,
});
