import * as React from "react";
import Web3 from "web3";
import { BigNumber } from "ethers";
import { Contract } from "web3-eth-contract";
import { AbiItem } from "web3-utils";
import { formatEther } from "@ethersproject/units";

import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import SwipeableViews from "react-swipeable-views";

import PriceOracleContract from "./contracts/IPriceOracle.sol/IPriceOracleGetter.json";
import ProtocolDataProviderContract from "./contracts/IProtocolDataProvider.sol/IProtocolDataProvider.json";
import IDebtTokenContract from "./contracts/IDebtToken.sol/IDebtToken.json";

import { SupportedNetwork, envObj } from "./env";
import { AssetPosition, TokenInfo, TokenAddresses, SwapVars } from "./types";
import {
  TOKEN_FIXED_PRECISION,
  PAY_BY_ETHER_SKEW,
  getNativeETHAmount,
} from "./utils";
import { BootstrapDialog, BootstrapDialogTitle } from "./DialogComponents";
import TokenSelect from "./TokenSelect";
import SlippageSelect, { SLIPPAGE_BASE_UINT } from "./SlippageSelect";
import TokenValueSlider from "./TokenValueSlider";
import RadioButtonsGroup from "./RadioButton";
import { ApprovalStep } from "./ApprovalStepper";
import SubmitSwipeView from "./SubmitSwipeView";
import FeeHealthFactorDisplay from "./FeeHealthFactorDisplay";

const MAX_TOKEN_AMOUNT_DECIMALS = 10 ** TOKEN_FIXED_PRECISION;

type LeverageDialogProps = {
  web3: Web3;
  aaveManager: Contract;
  account: string;
  assetList: AssetPosition[];
  disabled: boolean;
};

const LeverageDialog: React.FC<LeverageDialogProps> = ({
  web3,
  aaveManager,
  account,
  assetList,
  disabled,
}) => {
  const [dataProvider, setDataProvider] = React.useState<Contract>();
  const [priceOracle, setPriceOracle] = React.useState<Contract>();
  const [approvalSteps, setApprovalSteps] = React.useState<ApprovalStep[]>();
  // token address to AssetPosition
  const [assetMap, setAssetMap] = React.useState<Map<string, AssetPosition>>();
  const [collateralAssets, setCollateralAssets] = React.useState<
    AssetPosition[]
  >();
  const [borrowableAssets, setBorrowableAssets] = React.useState<
    AssetPosition[]
  >();
  const [targetToken, setTargetToken] = React.useState<TokenInfo>();
  const [pairToken, setPairToken] = React.useState<TokenInfo>();
  const [slippage, setSlippage] = React.useState<number>(2);
  const [targetTokenAmount, setTargetTokenAmount] = React.useState<BigNumber>(
    BigNumber.from(0)
  );
  const [payFeeByCollateral, setPayFeeByCollateral] = React.useState(true);
  const [useVariableRate, setUseVariableRate] = React.useState(true);
  const [maxTargetTokenAmount, setMaxTargetTokenAmount] = React.useState<
    number
  >();
  const [fee, setFee] = React.useState<BigNumber[]>();
  const [healthFactor, setHealthFactor] = React.useState<number>();
  const [errorMessage, setErrorMessage] = React.useState<string>();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [readyToSwap, setReadyToSwap] = React.useState(false);
  const [swapSucceeded, setSwapSucceeded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const getTokenInfo: (t: string) => Promise<TokenInfo> = React.useCallback(
    async (tokenAddress: string) => {
      return await aaveManager!.methods.getTokenInfo(tokenAddress).call();
    },
    [aaveManager]
  );

  const calculateMaxLoanAmount = React.useCallback(
    (maxLoanETH: BigNumber, token: TokenInfo, priceOracle: Contract) => {
      priceOracle.methods
        .getAssetPrice(token.tokenAddress)
        .call()
        .then((p: string) => {
          setMaxTargetTokenAmount(
            Number(
              BigNumber.from(maxLoanETH)
                .mul(MAX_TOKEN_AMOUNT_DECIMALS)
                .div(BigNumber.from(p))
            ) / MAX_TOKEN_AMOUNT_DECIMALS
          );
        });
    },
    []
  );

  React.useEffect(() => {
    const updateHealthFactor = async () => {
      if (priceOracle && targetToken && pairToken) {
        setLoading(true);
        let swapVars: SwapVars;
        try {
          swapVars = await aaveManager.methods
            .checkAndCalculateSwapVars(
              targetToken,
              targetTokenAmount,
              pairToken,
              SLIPPAGE_BASE_UINT.mul(slippage),
              payFeeByCollateral
            )
            .call({ from: account });
        } catch (e) {
          setErrorMessage((e as Error).message);
          return;
        } finally {
          setLoading(false);
        }
        setErrorMessage(undefined);
        calculateMaxLoanAmount(swapVars.maxLoanETH, targetToken, priceOracle);
        const healthFactor = Number(formatEther(swapVars.expectedHealthFactor));
        setHealthFactor(healthFactor);
        const feeETH = BigNumber.from(swapVars.feeETH).add(PAY_BY_ETHER_SKEW);
        const feeNative = await getNativeETHAmount(feeETH, priceOracle);
        if (feeETH.eq(feeNative)) {
          setFee([feeETH]);
        } else {
          setFee([feeETH, feeNative]);
        }
      }
    };
    updateHealthFactor();
  }, [
    aaveManager,
    priceOracle,
    account,
    targetToken,
    pairToken,
    targetTokenAmount,
    slippage,
    payFeeByCollateral,
    calculateMaxLoanAmount,
  ]);

  const handleLeveragedSwap = React.useCallback(async () => {
    setLoading(true);
    if (payFeeByCollateral) {
      return aaveManager!.methods
        .swapPreapprovedAssets(
          targetToken,
          targetTokenAmount,
          pairToken,
          useVariableRate ? 2 : 1,
          SLIPPAGE_BASE_UINT.mul(slippage)
        )
        .send({ from: account })
        .then(() => setSwapSucceeded(true))
        .catch((e: any) => setErrorMessage(e.message))
        .finally(() => {
          setLoading(false);
          setReadyToSwap(false);
        });
    } else {
      return aaveManager!.methods
        .swapPreapprovedAssets(
          targetToken,
          targetTokenAmount,
          pairToken,
          useVariableRate ? 2 : 1,
          SLIPPAGE_BASE_UINT.mul(slippage)
        )
        .send({ from: account, value: fee!.length === 1 ? fee![0] : fee![1] })
        .then(() => setSwapSucceeded(true))
        .catch((e: any) => setErrorMessage(e.message))
        .finally(() => {
          setLoading(false);
          setReadyToSwap(false);
        });
    }
  }, [
    aaveManager,
    payFeeByCollateral,
    targetToken,
    targetTokenAmount,
    pairToken,
    useVariableRate,
    slippage,
    fee,
    account,
  ]);

  const buildApprovalSteps = React.useCallback(() => {
    const checkAllowance = async (
      tokenContract: Contract,
      tokenAmount: BigNumber
    ) => {
      const allowance: string = await tokenContract.methods
        .borrowAllowance(account, process.env.REACT_APP_DEPLOYED_CONTRACT)
        .call();
      return BigNumber.from(allowance).gte(tokenAmount);
    };

    const approveAllowance = async (
      tokenContract: Contract,
      tokenAmount: BigNumber
    ) => {
      return await tokenContract.methods
        .approveDelegation(process.env.REACT_APP_DEPLOYED_CONTRACT, tokenAmount)
        .send({ from: account });
    };

    if (assetMap && dataProvider && targetToken) {
      dataProvider.methods
        .getReserveTokensAddresses(targetToken.tokenAddress)
        .call()
        .then((addresses: TokenAddresses) => {
          const tokenContract = new web3.eth.Contract(
            IDebtTokenContract.abi as AbiItem[],
            useVariableRate
              ? addresses.variableDebtTokenAddress
              : addresses.stableDebtTokenAddress
          );
          const targetTokenSymbol = assetMap.get(targetToken.tokenAddress)!
            .symbol;
          const step: ApprovalStep = {
            label: `Approve Delegation (${targetTokenSymbol})`,
            description: `Approve contract to borrow ${Number(
              formatEther(targetTokenAmount)
            ).toFixed(
              TOKEN_FIXED_PRECISION
            )} ${targetTokenSymbol} on behalf of you.`,
            checkAllowance: () =>
              checkAllowance(tokenContract, targetTokenAmount),
            approveAllowance: () =>
              approveAllowance(tokenContract, targetTokenAmount),
          };
          setApprovalSteps([step]);
        });
    }
  }, [
    web3,
    account,
    dataProvider,
    assetMap,
    targetToken,
    targetTokenAmount,
    useVariableRate,
  ]);

  const handleClickOpen = () => {
    setPriceOracle(
      new web3.eth.Contract(
        PriceOracleContract.abi as AbiItem[],
        envObj[
          SupportedNetwork[
            process.env.REACT_APP_NETWORK! as keyof typeof SupportedNetwork
          ]
        ].priceOracleContract
      )
    );
    setDataProvider(
      new web3.eth.Contract(
        ProtocolDataProviderContract.abi as AbiItem[],
        envObj[
          SupportedNetwork[
            process.env.REACT_APP_NETWORK! as keyof typeof SupportedNetwork
          ]
        ].protocalDataProviderContract
      )
    );
    setAssetMap(
      assetList.reduce((obj, element) => {
        obj.set(element.token, element);
        return obj;
      }, new Map<string, AssetPosition>())
    );

    // borrowables  and target token
    const collateralAssets = assetList.filter((asset) => asset.borrowable);
    setCollateralAssets(collateralAssets);
    if (collateralAssets.length > 0) {
      getTokenInfo(collateralAssets[0].token).then((t) => setTargetToken(t));
    }

    // collaterals and pair token
    const borrowableAssets = assetList.filter((asset) => asset.canBeCollateral);
    setBorrowableAssets(borrowableAssets);
    if (borrowableAssets.length > 0) {
      getTokenInfo(borrowableAssets[0].token).then((t) => setPairToken(t));
    }
    setOpen(true);
  };
  const handleClose = () => {
    setTargetTokenAmount(BigNumber.from(0));
    setStep(0);
    setOpen(false);
  };
  const handlePrepareSwap = React.useCallback(() => {
    buildApprovalSteps();
    setReadyToSwap(false);
    setStep(1);
  }, [buildApprovalSteps]);

  const finalizeApproval = React.useCallback(() => {
    setReadyToSwap(true);
  }, []);

  return (
    <div>
      <Button variant="outlined" disabled={disabled} onClick={handleClickOpen}>
        create a leveraged position
      </Button>
      <BootstrapDialog
        onClose={handleClose}
        aria-labelledby="customized-dialog-title"
        open={open}
        fullWidth={true}
        maxWidth={"md"}
      >
        <BootstrapDialogTitle
          id="customized-dialog-title"
          onClose={handleClose}
        >
          CREATE A LEVERAGED POSITION
        </BootstrapDialogTitle>
        <SwipeableViews index={step}>
          <div key={"leverage-prepare-swap"}>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TokenSelect
                    label="Target Token"
                    assets={collateralAssets}
                    tokenAddress={targetToken && targetToken.tokenAddress}
                    selectToken={(tokenAddress) =>
                      getTokenInfo(tokenAddress).then((t) => setTargetToken(t))
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TokenSelect
                    label="Pair Token"
                    assets={borrowableAssets}
                    tokenAddress={pairToken && pairToken.tokenAddress}
                    selectToken={(tokenAddress) =>
                      getTokenInfo(tokenAddress).then((t) => setPairToken(t))
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={12}>
                  <TokenValueSlider
                    label="Target Token Amount"
                    targetToken={
                      targetToken &&
                      assetMap &&
                      assetMap.get(targetToken.tokenAddress)
                    }
                    maxAmount={maxTargetTokenAmount}
                    setTokenValue={setTargetTokenAmount}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <RadioButtonsGroup
                    groupLabel="Borrow Rate Mode"
                    buttonLable1="Variable Rate"
                    buttonLable2="Stable Rate"
                    setSelectedValue={setUseVariableRate}
                    secondOptionDisabled={
                      !(targetToken && targetToken.stableBorrowRateEnabled)
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <RadioButtonsGroup
                    groupLabel="Fees"
                    buttonLable1="Pay by Collateral"
                    buttonLable2="Pay by Ether"
                    setSelectedValue={setPayFeeByCollateral}
                  />
                </Grid>
                <Grid item sx={{ mt: 2 }} xs={12} sm={3}>
                  <SlippageSelect
                    label="Slippage"
                    slippage={slippage}
                    slippageOptions={[1, 2, 3, 4, 5]}
                    selectSlippage={setSlippage}
                  />
                </Grid>
                <Grid item>
                  <FeeHealthFactorDisplay
                    fees={fee}
                    healthFactor={healthFactor}
                    errorMessage={errorMessage}
                    loading={loading}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button
                autoFocus
                disabled={targetTokenAmount.lte(0)}
                onClick={handlePrepareSwap}
              >
                next
              </Button>
            </DialogActions>
          </div>
          <SubmitSwipeView
            keyStr="leverage-swap"
            approvalSteps={approvalSteps}
            errorMessage={errorMessage}
            loading={loading}
            readyToSwap={readyToSwap}
            swapSucceeded={swapSucceeded}
            handleSubmit={handleLeveragedSwap}
            finalizeApproval={finalizeApproval}
            setStep={setStep}
          />
        </SwipeableViews>
      </BootstrapDialog>
    </div>
  );
};

export default LeverageDialog;
