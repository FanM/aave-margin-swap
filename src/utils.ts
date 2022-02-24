import { BigNumber } from "ethers";
import { Contract } from "web3-eth-contract";
import { envObj, SupportedNetwork } from "./env";

export const TOKEN_FIXED_PRECISION = 8;
export const HEALTH_FACTOR_FIXED_PRECISION = 2;
export const WEI_DECIMALS = 18;
export const PAY_BY_ETHER_SKEW = 5;
export const WAD = BigNumber.from(10).pow(WEI_DECIMALS);
export const NATIVE_TOKEN_SYMBOL =
  envObj[
    SupportedNetwork[
      process.env.REACT_APP_NETWORK! as keyof typeof SupportedNetwork
    ]
  ].nativeETHSymbol;

export async function getNativeETHAmount(
  valueETH: BigNumber,
  priceOracle: Contract
): Promise<BigNumber> {
  const priceStr: string = await priceOracle.methods
    .getAssetPrice(
      envObj[
        SupportedNetwork[
          process.env.REACT_APP_NETWORK! as keyof typeof SupportedNetwork
        ]
      ].nativeETHContract
    )
    .call();
  const price = BigNumber.from(priceStr);
  if (price.eq(WAD)) {
    return valueETH;
  } else {
    return valueETH.mul(WAD).div(price);
  }
}
