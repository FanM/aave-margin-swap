import * as React from "react";
import Web3 from "web3";
import { BigNumber } from "ethers";
import { Contract } from "web3-eth-contract";
import { AbiItem } from "web3-utils";
import { formatEther } from "@ethersproject/units";

import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import DialogContent from "@mui/material/DialogContent";
import Typography from "@mui/material/Typography";

import PriceOracleContract from "./contracts/IPriceOracle.sol/IPriceOracleGetter.json";
import ProtocolDataProviderContract from "./contracts/IProtocolDataProvider.sol/IProtocolDataProvider.json";
import IDebtTokenContract from "./contracts/IDebtToken.sol/IDebtToken.json";

import { AssetPosition, TokenInfo, TokenAddresses, SwapVars } from "./types";
import { BootstrapDialog, BootstrapDialogTitle } from "./DialogComponents";
import TokenSelect from "./TokenSelect";
import SlippageSelect, { SLIPPAGE_BASE_UINT } from "./SlippageSelect";
import TokenValueSlider from "./TokenValueSlider";
import RadioButtonsGroup from "./RadioButton";
import ApprovalStepper, { ApprovalStep } from "./ApprovalStepper";

const MAX_TOKEN_AMOUNT_DECIMALS = 100000000; // 8 zeros

type LeverageDialogProps = {
  web3: Web3;
  aaveManager: Contract;
  account: string;
  assetList: AssetPosition[];
};

const LeverageDialog: React.FC<LeverageDialogProps> = ({
  web3,
  aaveManager,
  account,
  assetList,
}) => {
  const [dataProvider, setDataProvider] = React.useState<Contract>();
  const [priceOracle, setPriceOracle] = React.useState<Contract>();
  const [approvalSteps, setApprovalSteps] = React.useState<ApprovalStep[]>();
  // token address to AssetPosition
  const [assetMap, setAssetMap] = React.useState<Map<string, AssetPosition>>();
  const [collateralAssets, setCollateralAssets] =
    React.useState<AssetPosition[]>();
  const [borrowableAssets, setBorrowableAssets] =
    React.useState<AssetPosition[]>();
  const [targetToken, setTargetToken] = React.useState<TokenInfo>();
  const [pairToken, setPairToken] = React.useState<TokenInfo>();
  const [slippage, setSlippage] = React.useState<number>(2);
  const [targetTokenAmount, setTargetTokenAmount] = React.useState<BigNumber>(
    BigNumber.from(0)
  );
  const [payFeeByCollateral, setPayFeeByCollateral] = React.useState(true);
  const [useVariableRate, setUseVariableRate] = React.useState(true);
  const [maxTargetTokenAmount, setMaxTargetTokenAmount] =
    React.useState<number>();
  const [swapVars, setSwapVars] = React.useState<SwapVars>();
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const getTokenInfo: (t: string) => Promise<TokenInfo> = React.useCallback(
    async (tokenAddress: string) => {
      return await aaveManager!.methods.getTokenInfo(tokenAddress).call();
    },
    [aaveManager]
  );

  const calculateMaxLoanAmount = React.useCallback(
    (maxLoanETH: string, token: TokenInfo, priceOracle: Contract) => {
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
        const swapVars = await aaveManager.methods
          .checkAndCalculateSwapVars(
            targetToken,
            targetTokenAmount,
            pairToken,
            SLIPPAGE_BASE_UINT.mul(slippage),
            payFeeByCollateral
          )
          .call({ from: account });
        calculateMaxLoanAmount(swapVars.maxLoanETH, targetToken, priceOracle);
        setSwapVars(swapVars);
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
    if (payFeeByCollateral) {
      return aaveManager!.methods
        .swapPreapprovedAssets(
          targetToken,
          targetTokenAmount,
          pairToken,
          useVariableRate ? 2 : 1,
          SLIPPAGE_BASE_UINT.mul(slippage)
        )
        .send({ from: account });
    } else {
      return aaveManager!.methods
        .swapPreapprovedAssets(
          targetToken,
          targetTokenAmount,
          pairToken,
          useVariableRate ? 2 : 1,
          SLIPPAGE_BASE_UINT.mul(slippage)
        )
        .send({ from: account, value: swapVars!.feeETH });
    }
  }, [
    aaveManager,
    payFeeByCollateral,
    targetToken,
    targetTokenAmount,
    pairToken,
    useVariableRate,
    slippage,
    swapVars,
    account,
  ]);

  React.useEffect(() => {
    const checkAllowance = async (
      tokenContract: Contract,
      tokenAmount: BigNumber
    ) => {
      const balance: string = await tokenContract.methods
        .borrowAllowance(account, process.env.REACT_APP_DEPLOYED_CONTRACT)
        .call();
      return BigNumber.from(balance).gte(tokenAmount);
    };

    const approveAllowance = async (
      tokenContract: Contract,
      tokenAmount: BigNumber
    ) => {
      return await tokenContract.methods
        .approveDelegation(process.env.REACT_APP_DEPLOYED_CONTRACT, tokenAmount)
        .send({ from: account });
    };

    const buildApprovalSteps = () => {
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
            const step: ApprovalStep = {
              label: "Approve Delegation",
              description: `Approve contract to borrow ${formatEther(
                targetTokenAmount
              )} amount of ${
                assetMap.get(targetToken.tokenAddress)!.symbol
              } on behalf of you.`,
              checkAllowance: () =>
                checkAllowance(tokenContract, targetTokenAmount),
              approveAllowance: () =>
                approveAllowance(tokenContract, targetTokenAmount),
            };
            setApprovalSteps([step]);
          });
      }
    };
    buildApprovalSteps();
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
        process.env.REACT_APP_PRICE_ORACLE_CONTRACT
      )
    );
    setDataProvider(
      new web3.eth.Contract(
        ProtocolDataProviderContract.abi as AbiItem[],
        process.env.REACT_APP_POTOCOL_DATA_PROVIDER_CONTRACT
      )
    );
    setAssetMap(
      assetList.reduce((obj, element) => {
        obj.set(element.token, element);
        return obj;
      }, new Map<string, AssetPosition>())
    );

    // collaterals and target token
    const collateralAssets = assetList.filter((asset) => asset.canBeCollateral);
    setCollateralAssets(collateralAssets);
    if (collateralAssets.length > 0) {
      getTokenInfo(collateralAssets[0].token).then((t) => setTargetToken(t));
    }

    // borrowables and pair token
    const borrowableAssets = assetList.filter((asset) => asset.borrowable);
    setBorrowableAssets(borrowableAssets);
    if (borrowableAssets.length > 0) {
      getTokenInfo(borrowableAssets[0].token).then((t) => setPairToken(t));
    }
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };
  const handleTargetTokenAmountSelect = React.useCallback((v: BigNumber) => {
    if (v.gt(0)) {
      setTargetTokenAmount(v);
      setExpanded(true);
    } else {
      setExpanded(false);
    }
  }, []);

  return (
    <div>
      <Button
        variant="outlined"
        disabled={!assetList}
        onClick={handleClickOpen}
      >
        Leverage
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
          CREATE A LEVERAGE SWAP
        </BootstrapDialogTitle>
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
            <Grid item xs={12} sm={9}>
              <TokenValueSlider
                targetToken={
                  targetToken &&
                  assetMap &&
                  assetMap.get(targetToken.tokenAddress)
                }
                maxAmount={maxTargetTokenAmount}
                setTokenValue={handleTargetTokenAmountSelect}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <SlippageSelect
                label="Slippage"
                slippage={slippage}
                slippageOptions={[1, 2, 3, 4, 5]}
                selectSlippage={setSlippage}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
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
            <Grid item xs={12} sm={6}>
              <RadioButtonsGroup
                groupLabel="Fees"
                buttonLable1="Pay by Collateral"
                buttonLable2="Pay by Ether"
                setSelectedValue={setPayFeeByCollateral}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography gutterBottom>
                {`Fees: ${
                  swapVars ? formatEther(swapVars.feeETH) : "--"
                } ether`}
              </Typography>
              <Typography gutterBottom>
                {`New Health Factor: ${
                  swapVars &&
                  BigNumber.from(swapVars.expectedHealthFactor).lt(BigInt(1e22))
                    ? formatEther(swapVars.expectedHealthFactor)
                    : "--"
                }`}
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <Collapse in={expanded}>
          <DialogContent>
            {approvalSteps && (
              <ApprovalStepper
                steps={approvalSteps}
                label="All set. Now swap your assets"
                action={handleLeveragedSwap}
              />
            )}
          </DialogContent>
        </Collapse>
      </BootstrapDialog>
    </div>
  );
};

export default LeverageDialog;
