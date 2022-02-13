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

type SwapVars = [
  BigNumber,
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
  existDebtETH: BigNumber;
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
export default function LeverageDialog(props: LeverageDialogProps) {
  const [assetMap, setAssetMap] = React.useState<Map<string, AssetPosition>>();
  const [collateralAssets, setCollateralAssets] =
    React.useState<AssetPosition[]>();
  const [borrowableAssets, setBorrowableAssets] =
    React.useState<AssetPosition[]>();
  const [targetToken, setTargetToken] = React.useState<AssetPosition>();
  const [pairToken, setPairToken] = React.useState<AssetPosition>();
  const [slippage, setSlippage] = React.useState<number>(2);
  const [targetTokenAmount, setTargetTokenAmount] = React.useState<BigInt>(
    BigInt(1000)
  );
  const [maxTargetTokenAmount, setMaxTargetTokenAmount] =
    React.useState<BigInt>();
  const [swapVars, setSwapVars] = React.useState<SwapVars>();
  const [open, setOpen] = React.useState(false);

  const calculateMaxLoanAmount = React.useCallback(
    (maxLoanETH: string, token: AssetPosition, priceOracle: Contract) => {
      priceOracle.methods
        .getAssetPrice(token.token)
        .call()
        .then((p: string) => {
          setMaxTargetTokenAmount(BigInt(maxLoanETH) / BigInt(p));
        });
    },
    []
  );

  React.useEffect(() => {
    const updateHealthFactor = async () => {
      if (props.aaveManager && props.account && targetToken && pairToken) {
        const targetTokenInfo = await props.aaveManager.methods
          .getTokenInfo(targetToken.token)
          .call();
        const pairTokenInfo = await props.aaveManager.methods
          .getTokenInfo(pairToken.token)
          .call();
        const swapVars = await props.aaveManager.methods
          .checkAndCalculateSwapVars(
            targetTokenInfo,
            targetTokenAmount,
            pairTokenInfo,
            slippage * 100,
            true
          )
          .call({ from: props.account });
        calculateMaxLoanAmount(
          swapVars.maxLoanETH,
          targetToken,
          props.priceOracle!
        );
        setSwapVars(swapVars);
      }
    };
    updateHealthFactor();
  }, [
    props,
    targetToken,
    pairToken,
    targetTokenAmount,
    slippage,
    calculateMaxLoanAmount,
  ]);

  React.useEffect(() => {
    if (props.assetList) {
      setAssetMap(
        props.assetList.reduce((obj, element) => {
          obj.set(element.symbol, element);
          return obj;
        }, new Map<string, AssetPosition>())
      );

      // collaterals and target token
      const collateralAssets = props.assetList.filter(
        (asset) => asset.canBeCollateral
      );
      setCollateralAssets(collateralAssets);
      if (collateralAssets.length > 0) setTargetToken(collateralAssets[0]);

      // borrowables and pair token
      const borrowableAssets = props.assetList.filter(
        (asset) => asset.borrowable
      );
      setBorrowableAssets(borrowableAssets);
      if (borrowableAssets.length > 0) setPairToken(borrowableAssets[0]);
    }
  }, [props]);

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
            <Grid item xs={12} sm={6}>
              <SlippageSelect
                label="Slippage"
                slippage={slippage}
                slippageOptions={[1, 2, 3, 4, 5]}
                selectSlippage={setSlippage}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography gutterBottom>
                {`Max Loan Amount: ${
                  maxTargetTokenAmount ? maxTargetTokenAmount.toString() : "--"
                }`}
              </Typography>
              <Typography gutterBottom>
                {`Health Factor: ${
                  swapVars ? formatEther(swapVars.expectedHealthFactor) : "--"
                }`}
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={handleClose}>
            swap
          </Button>
        </DialogActions>
      </BootstrapDialog>
    </div>
  );
}
