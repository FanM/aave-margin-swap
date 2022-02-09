import { InjectedConnector } from "@web3-react/injected-connector";
import { WalletConnectConnector } from "@web3-react/walletconnect-connector";

const RPC_URLS: { [chainId: number]: string } = {
  137: process.env.REACT_APP_RPC_URL_137 as string,
  8001: process.env.REACT_APP_RPC_URL_8001 as string,
  31337: process.env.REACT_APP_RPC_URL_31337 as string,
};

export const injected = new InjectedConnector({
  supportedChainIds: [31337, 137, 8001],
});

export const walletconnect = new WalletConnectConnector({
  rpc: RPC_URLS,
  chainId: 31337,
  bridge: "https://bridge.walletconnect.org",
  qrcode: true,
});
