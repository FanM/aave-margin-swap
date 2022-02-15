import * as React from "react";
import { BigNumber } from "ethers";
import { Contract } from "web3-eth-contract";
import { formatEther } from "@ethersproject/units";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import { styled } from "@mui/material/styles";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Typography from "@mui/material/Typography";
import Select, { SelectChangeEvent } from "@mui/material/Select";

import { AssetPosition } from "./AssetPanel";
import TokenValueSlider from "./TokenValueSlider";
import RadioButtonsGroup from "./RadioButton";

type SwapVars = [
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber,
  BigNumber
] & {
  loanETH: BigNumber;
  maxLoanETH: BigNumber;
  feeETH: BigNumber;
  flashLoanETH: BigNumber;
  currentHealthFactor: BigNumber;
  expectedHealthFactor: BigNumber;
};

type TokenSelectProps = {
  assets: AssetPosition[] | undefined;
  token: AssetPosition | undefined;
  assetMap: Map<string, AssetPosition> | undefined;
  selectToken: (token: AssetPosition | undefined) => void;
  label: string;
};

const TokenSelect = (props: TokenSelectProps) => {
  const handleTokenSelect = (event: SelectChangeEvent) => {
    if (props.assetMap)
      props.selectToken(props.assetMap.get(event.target.value));
  };

  return (
    <Box sx={{ minWidth: 120 }}>
      {props.assets && props.token && (
        <FormControl fullWidth>
          <InputLabel id="token-select-label">{props.label}</InputLabel>
          <Select
            labelId="token-select-label"
            id="token-select"
            value={props.token.symbol}
            label={props.label}
            onChange={handleTokenSelect}
          >
            {props.assets.map((asset, index) => (
              <MenuItem key={index} value={asset.symbol}>
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
  aaveManager: Contract | undefined;
  priceOracle: Contract | undefined;
  account: string | null | undefined;
  assetList: AssetPosition[] | undefined;
};
export const LeverageDialog: React.FC<LeverageDialogProps> = ({
  aaveManager,
  priceOracle,
  account,
  assetList,
}) => {
  const [assetMap, setAssetMap] = React.useState<Map<string, AssetPosition>>();
  const [collateralAssets, setCollateralAssets] =
    React.useState<AssetPosition[]>();
  const [borrowableAssets, setBorrowableAssets] =
    React.useState<AssetPosition[]>();
  const [targetToken, setTargetToken] = React.useState<AssetPosition>();
  const [pairToken, setPairToken] = React.useState<AssetPosition>();
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

  const calculateMaxLoanAmount = React.useCallback(
    (maxLoanETH: string, token: AssetPosition, priceOracle: Contract) => {
      priceOracle.methods
        .getAssetPrice(token.token)
        .call()
        .then((p: string) => {
          setMaxTargetTokenAmount(
            Number(BigNumber.from(maxLoanETH).div(BigNumber.from(p)))
          );
        });
    },
    []
  );

  React.useEffect(() => {
    const updateHealthFactor = async () => {
      if (aaveManager && account && targetToken && pairToken) {
        const targetTokenInfo = await aaveManager.methods
          .getTokenInfo(targetToken.token)
          .call();
        const pairTokenInfo = await aaveManager.methods
          .getTokenInfo(pairToken.token)
          .call();
        const swapVars = await aaveManager.methods
          .checkAndCalculateSwapVars(
            targetTokenInfo,
            targetTokenAmount,
            pairTokenInfo,
            slippage * 100,
            payFeeByCollateral
          )
          .call({ from: account });
        calculateMaxLoanAmount(swapVars.maxLoanETH, targetToken, priceOracle!);
        setSwapVars(swapVars);
      }
    };
    updateHealthFactor();
  }, [
    aaveManager,
    account,
    priceOracle,
    targetToken,
    pairToken,
    targetTokenAmount,
    slippage,
    payFeeByCollateral,
    calculateMaxLoanAmount,
  ]);

  React.useEffect(() => {
    if (assetList) {
      setAssetMap(
        assetList.reduce((obj, element) => {
          obj.set(element.symbol, element);
          return obj;
        }, new Map<string, AssetPosition>())
      );

      // collaterals and target token
      const collateralAssets = assetList.filter(
        (asset) => asset.canBeCollateral
      );
      setCollateralAssets(collateralAssets);
      if (collateralAssets.length > 0) setTargetToken(collateralAssets[0]);

      // borrowables and pair token
      const borrowableAssets = assetList.filter((asset) => asset.borrowable);
      setBorrowableAssets(borrowableAssets);
      if (borrowableAssets.length > 0) setPairToken(borrowableAssets[0]);
    }
  }, [assetList]);

  const handleClickOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };

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
                token={targetToken}
                assetMap={assetMap}
                selectToken={setTargetToken}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TokenSelect
                label="Pair Token"
                assets={borrowableAssets}
                token={pairToken}
                assetMap={assetMap}
                selectToken={setPairToken}
              />
            </Grid>
            <Grid item xs={12} sm={9}>
              <TokenValueSlider
                maxAmount={maxTargetTokenAmount}
                setTokenValue={setTargetTokenAmount}
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
        <DialogActions>
          <Button autoFocus onClick={handleClose}>
            prepare swap
          </Button>
        </DialogActions>
      </BootstrapDialog>
    </div>
  );
};

export default LeverageDialog;
