export enum SupportedNetwork {
  mainnet = "mainnet",
  kovan = "kovan",
  polygon = "polygon",
}

type ContractDependency = {
  priceOracleContract: string;
  protocalDataProviderContract: string;
  nativeETHContract: string;
  nativeETHSymbol: string;
  rpcUrl: string;
};

export const envObj: { [key in SupportedNetwork]: ContractDependency } = {
  polygon: {
    priceOracleContract: "0x0229f777b0fab107f9591a41d5f02e4e98db6f2d",
    protocalDataProviderContract: "0x7551b5D2763519d4e37e8B81929D336De671d46d",
    nativeETHContract: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
    nativeETHSymbol: "MATIC",
    rpcUrl: "https://polygon-rpc.com",
  },
  mainnet: {
    priceOracleContract: "0xa50ba011c48153de246e5192c8f9258a2ba79ca9",
    protocalDataProviderContract: "0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d",
    nativeETHContract: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    nativeETHSymbol: "ETH",
    rpcUrl: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
  },
  kovan: {
    priceOracleContract: "0xb8be51e6563bb312cbb2aa26e352516c25c26ac1",
    protocalDataProviderContract: "0x3c73a5e5785cac854d468f727c606c07488a29d6",
    nativeETHContract: "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
    nativeETHSymbol: "ETH",
    rpcUrl: "https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
  },
};
