export enum SupportedNetwork {
  mainnet = "mainnet",
  polygon = "polygon",
}

type ContractDependency = {
  priceOracleContract: string;
  protocalDataProviderContract: string;
  nativeETHContract: string;
  nativeETHSymbol: string;
};

export const envObj: { [key in SupportedNetwork]: ContractDependency } = {
  polygon: {
    priceOracleContract: "0x0229f777b0fab107f9591a41d5f02e4e98db6f2d",
    protocalDataProviderContract: "0x7551b5D2763519d4e37e8B81929D336De671d46d",
    nativeETHContract: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
    nativeETHSymbol: "MATIC",
  },
  mainnet: {
    priceOracleContract: "0xa50ba011c48153de246e5192c8f9258a2ba79ca9",
    protocalDataProviderContract: "0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d",
    nativeETHContract: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    nativeETHSymbol: "ETH",
  },
};
