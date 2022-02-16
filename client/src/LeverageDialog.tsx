import * as React from "react";
import Web3 from "web3";
import { BigNumber } from "ethers";
import { Contract } from "web3-eth-contract";
import { AbiItem } from "web3-utils";
import { formatEther } from "@ethersproject/units";

import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import { styled } from "@mui/material/styles";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Typography from "@mui/material/Typography";
import Select, { SelectChangeEvent } from "@mui/material/Select";

import PriceOracleContract from "./contracts/IPriceOracle.sol/IPriceOracleGetter.json";
import ProtocolDataProviderContract from "./contracts/IProtocolDataProvider.sol/IProtocolDataProvider.json";
import IDebtTokenContract from "./contracts/IDebtToken.sol/IDebtToken.json";

import { AssetPosition, TokenInfo, TokenAddresses, SwapVars } from "./types";
import TokenValueSlider from "./TokenValueSlider";
import RadioButtonsGroup from "./RadioButton";
import ApprovalStepper, { ApprovalStep } from "./ApprovalStepper";

const MAX_TOKEN_AMOUNT_DECIMALS = 100000000; // 8 zeros
const SLIPPAGE_BASE_UINT = BigNumber.from(100);

type TokenSelectProps = {
  assets: AssetPosition[] | undefined;
  tokenAddress: string | undefined;
  selectToken: (tokenAddress: string) => void;
  label: string;
};

const TokenSelect: React.FC<TokenSelectProps> = ({
  assets,
  tokenAddress,
  selectToken,
  label,
}) => {
  const handleTokenSelect = (event: SelectChangeEvent) => {
    selectToken(event.target.value);
  };

  return (
    <Box sx={{ minWidth: 120 }}>
      {assets && tokenAddress && (
        <FormControl fullWidth>
          <InputLabel id="token-select-label">{label}</InputLabel>
          <Select
            labelId="token-select-label"
            id="token-select"
            value={tokenAddress}
            label={label}
            onChange={handleTokenSelect}
          >
            {assets.map((asset, index) => (
              <MenuItem key={index} value={asset.token}>
                {asset.symbol}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Box>
  );
};

type SlippageSelectProps = {
  slippage: number | undefined;
  slippageOptions: number[];
  selectSlippage: (slippage: number) => void;
  label: string;
};
const SlippageSelect = (props: SlippageSelectProps) => {
  const handleSlippageSelect = (event: SelectChangeEvent) => {
    props.selectSlippage(Number(event.target.value));
  };

  return (
    <Box sx={{ maxWidth: 80 }}>
      {props.slippage && (
        <FormControl fullWidth>
          <InputLabel id="token-select-label">{props.label}</InputLabel>
          <Select
            labelId="token-select-label"
            id="token-select"
            value={props.slippage.toString()}
            label={props.label}
            onChange={handleSlippageSelect}
          >
            {props.slippageOptions.map((s, index) => (
              <MenuItem key={index} value={s}>
                {s}%
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Box>
  );
};

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
  "& .MuiDialogContent-root": {
    padding: theme.spacing(2),
  },
  "& .MuiDialogActions-root": {
    padding: theme.spacing(1),
  },
}));

export interface DialogTitleProps {
  id: string;
  children?: React.ReactNode;
  onClose: () => void;
}

const BootstrapDialogTitle = (props: DialogTitleProps) => {
  const { children, onClose, ...other } = props;

  return (
    <DialogTitle sx={{ m: 0, p: 2 }} {...other}>
      {children}
      {onClose ? (
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: "absolute",
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      ) : null}
    </DialogTitle>
  );
};

type LeverageDialogProps = {
  web3: Web3 | undefined;
  aaveManager: Contract | undefined;
  account: string | null | undefined;
  assetList: AssetPosition[] | undefined;
};

export const LeverageDialog: React.FC<LeverageDialogProps> = ({
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

  const handleLeveragedSwap = React.useCallback(async () => {
    if (payFeeByCollateral) {
      return aaveManager!.methods
        .swapPreapprovedAssets(
          targetToken,
          targetTokenAmount,
          pairToken,
          useVariableRate ? 2 : 1,
          SLIPPAGE_BASE_UINT.mul(20)
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
    const updateHealthFactor = async () => {
      if (aaveManager && priceOracle && account && targetToken && pairToken) {
        const swapVars = await aaveManager.methods
          .checkAndCalculateSwapVars(
            targetToken,
            targetTokenAmount,
            pairToken,
            slippage * 100,
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

  React.useEffect(() => {
    if (web3 && assetMap && dataProvider && targetToken) {
      dataProvider.methods
        .getReserveTokensAddresses(targetToken.tokenAddress)
        .call()
        .then((addresses: TokenAddresses) => {
          const debtTokenAddress = useVariableRate
            ? addresses.variableDebtTokenAddress
            : addresses.stableDebtTokenAddress;

          const step: ApprovalStep = {
            label: "Approve Delegation",
            description: `Approve contract to borrow ${formatEther(
              targetTokenAmount
            )} ${
              assetMap.get(targetToken.tokenAddress)!.symbol
            } on behalf of you.`,
            tokenAddress: targetToken.tokenAddress,
            tokenAmount: targetTokenAmount,
            tokenContract: new web3.eth.Contract(
              IDebtTokenContract.abi as AbiItem[],
              debtTokenAddress
            ),
          };
          setApprovalSteps([step]);
        });
    }
  }, [
    web3,
    dataProvider,
    assetMap,
    targetToken,
    targetTokenAmount,
    useVariableRate,
  ]);

  React.useEffect(() => {
    if (web3) {
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
    }
    if (assetList) {
      setAssetMap(
        assetList.reduce((obj, element) => {
          obj.set(element.token, element);
          return obj;
        }, new Map<string, AssetPosition>())
      );

      // collaterals and target token
      const collateralAssets = assetList.filter(
        (asset) => asset.canBeCollateral
      );
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
    }
  }, [web3, assetList, getTokenInfo]);

  const handleClickOpen = () => {
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
      <Button variant="outlined" onClick={handleClickOpen}>
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
                account={account}
              />
            )}
          </DialogContent>
        </Collapse>
      </BootstrapDialog>
    </div>
  );
};

export default LeverageDialog;
