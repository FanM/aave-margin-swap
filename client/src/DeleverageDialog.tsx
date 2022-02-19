import * as React from "react";
import Web3 from "web3";
import { BigNumber } from "ethers";
import { Contract } from "web3-eth-contract";
import { AbiItem } from "web3-utils";
import { formatEther } from "@ethersproject/units";

import Paper from "@mui/material/Paper";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import ProtocolDataProviderContract from "./contracts/IProtocolDataProvider.sol/IProtocolDataProvider.json";
import IERC20Contract from "./contracts/IERC20.sol/IERC20.json";

import {
  AssetPosition,
  TokenInfo,
  TokenAddresses,
  RepayVars,
  tuple,
} from "./types";
import { BootstrapDialog, BootstrapDialogTitle } from "./DialogComponents";
import TokenValueSlider from "./TokenValueSlider";
import SlippageSelect, { SLIPPAGE_BASE_UINT } from "./SlippageSelect";
import RadioButtonsGroup from "./RadioButton";
import ApprovalStepper, { ApprovalStep } from "./ApprovalStepper";

const WEI_DECIMALS = 18;

type AssetPaneProps = {
  assets: AssetPosition[] | undefined;
  handleCollateralReduction: (index: number, amount: BigNumber) => void;
};

const CollateralPane = (props: AssetPaneProps) => {
  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 350 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Collateral</TableCell>
            <TableCell align="right">Amount to reduce</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {props.assets &&
            props.assets.map((asset, index) => (
              <TableRow
                key={index}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {asset.symbol}
                </TableCell>
                <TableCell align="right">
                  <TokenValueSlider
                    label=""
                    targetToken={asset}
                    maxAmount={Number(formatEther(asset.aTokenBalance))}
                    setTokenValue={(value) =>
                      props.handleCollateralReduction(index, value)
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

type DeleverageDialogProps = {
  web3: Web3;
  aaveManager: Contract;
  account: string;
  collateralList: AssetPosition[] | undefined;
  targetToken: AssetPosition;
  maxTargetTokenAmount: number;
  borrowRateMode: 1 | 2;
};

const DeleverageDialog: React.FC<DeleverageDialogProps> = ({
  web3,
  aaveManager,
  account,
  collateralList,
  targetToken,
  maxTargetTokenAmount,
  borrowRateMode,
}) => {
  const [dataProvider, setDataProvider] = React.useState<Contract>();
  const [collateralReducedAmounts, setCollateralReducedAmounts] =
    React.useState<Array<BigNumber>>();
  const [approvalSteps, setApprovalSteps] = React.useState<ApprovalStep[]>();
  const [targetTokenInfo, setTargetTokenInfo] = React.useState<TokenInfo>();
  const [targetTokenAmount, setTargetTokenAmount] = React.useState<BigNumber>(
    BigNumber.from(0)
  );
  const [payFeeByCollateral, setPayFeeByCollateral] = React.useState(true);
  const [slippage, setSlippage] = React.useState<number>(2);
  const [repayVars, setRepayVars] = React.useState<RepayVars>();
  const [errorMessage, setErrorMessage] = React.useState<string>();
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const getTokenInfo: (t: string) => Promise<TokenInfo> = React.useCallback(
    async (tokenAddress: string) => {
      return await aaveManager!.methods.getTokenInfo(tokenAddress).call();
    },
    [aaveManager]
  );

  const buildToBeReducedCollaterals = React.useCallback(async () => {
    const assetInfos: TokenInfo[] = [];
    const amounts: BigNumber[] = [];
    const assetSymbols: string[] = [];
    if (collateralReducedAmounts) {
      for (let i = 0; i < collateralReducedAmounts.length; i++) {
        const amount = collateralReducedAmounts[i];
        if (!!amount && amount.gt(0)) {
          const assetInfo = await getTokenInfo(collateralList![i].token);
          assetInfos.push(assetInfo);
          amounts.push(amount);
          assetSymbols.push(collateralList![i].symbol);
        }
      }
    }
    return tuple(assetInfos, amounts, assetSymbols);
  }, [collateralList, collateralReducedAmounts, getTokenInfo]);

  React.useEffect(() => {
    const updateHealthFactor = async () => {
      if (targetTokenInfo) {
        const [assetInfos, amounts] = await buildToBeReducedCollaterals();
        const repayVars: RepayVars = await aaveManager.methods
          .checkAndCalculateRepayVars(
            assetInfos,
            amounts,
            targetTokenInfo,
            targetTokenAmount,
            borrowRateMode,
            SLIPPAGE_BASE_UINT.mul(slippage),
            payFeeByCollateral
          )
          .call({ from: account });
        if (
          BigNumber.from(repayVars.expectedHealthFactor).div(WEI_DECIMALS).lt(1)
        ) {
          setErrorMessage("Health Factor is less than 1");
        } else if (
          BigNumber.from(repayVars.totalCollateralReducedETH).lt(
            BigNumber.from(repayVars.loanETH)
          )
        ) {
          setErrorMessage("Collaterals reduced not enough to repay debt");
        } else {
          setErrorMessage(undefined);
        }
        setRepayVars(repayVars);
      }
    };
    updateHealthFactor();
  }, [
    aaveManager,
    account,
    targetTokenInfo,
    targetTokenAmount,
    slippage,
    payFeeByCollateral,
    buildToBeReducedCollaterals,
    borrowRateMode,
  ]);

  const handleClickOpen = () => {
    setDataProvider(
      new web3.eth.Contract(
        ProtocolDataProviderContract.abi as AbiItem[],
        process.env.REACT_APP_POTOCOL_DATA_PROVIDER_CONTRACT
      )
    );
    getTokenInfo(targetToken.token).then((t: TokenInfo) => {
      setTargetTokenInfo(t);
    });
    setOpen(true);
  };

  const handleClose = () => {
    setCollateralReducedAmounts(undefined);
    setTargetTokenAmount(BigNumber.from(0));
    setExpanded(false);
    setOpen(false);
  };

  const handleCollateralReducedAmountSelect = (index: number, v: BigNumber) => {
    setCollateralReducedAmounts((prevAmounts) => {
      let newCollateralReducedAmounts: Array<BigNumber>;
      if (prevAmounts) {
        newCollateralReducedAmounts = [...prevAmounts];
      } else {
        newCollateralReducedAmounts = new Array<BigNumber>();
      }
      newCollateralReducedAmounts[index] = v;
      return newCollateralReducedAmounts;
    });
  };

  const handleDeleverage = React.useCallback(async () => {
    const [assetInfos, amounts] = await buildToBeReducedCollaterals();
    if (payFeeByCollateral) {
      return aaveManager.methods
        .repayDebt(
          assetInfos,
          amounts,
          targetTokenInfo,
          targetTokenAmount,
          borrowRateMode,
          SLIPPAGE_BASE_UINT.mul(slippage)
        )
        .send({ from: account });
    } else {
      return aaveManager.methods
        .repayDebt(
          assetInfos,
          amounts,
          targetTokenInfo,
          targetTokenAmount,
          borrowRateMode,
          SLIPPAGE_BASE_UINT.mul(slippage)
        )
        .send({ from: account, value: repayVars!.feeETH });
    }
  }, [
    aaveManager,
    payFeeByCollateral,
    targetTokenInfo,
    targetTokenAmount,
    borrowRateMode,
    slippage,
    repayVars,
    account,
    buildToBeReducedCollaterals,
  ]);

  const buildApprovalSteps = React.useCallback(async () => {
    const checkAllowance = async (
      tokenContract: Contract,
      tokenAmount: BigNumber
    ) => {
      const allowance: string = await tokenContract.methods
        .allowance(account, process.env.REACT_APP_DEPLOYED_CONTRACT)
        .call();
      return BigNumber.from(allowance).gte(tokenAmount);
    };

    const approveAllowance = async (
      tokenContract: Contract,
      tokenAmount: BigNumber
    ) => {
      return await tokenContract.methods
        .approve(process.env.REACT_APP_DEPLOYED_CONTRACT, tokenAmount)
        .send({ from: account });
    };

    const weiToTokenUnit = (amount: BigNumber, decimals: number) => {
      if (decimals >= WEI_DECIMALS) {
        return amount.mul(10 ** (decimals - WEI_DECIMALS));
      } else {
        return amount.div(10 ** (WEI_DECIMALS - decimals));
      }
    };

    if (dataProvider) {
      const steps: ApprovalStep[] = [];
      const [assetInfos, amounts, assetSymbols] =
        await buildToBeReducedCollaterals();
      for (let i = 0; i < assetInfos.length; i++) {
        const addresses: TokenAddresses = await dataProvider.methods
          .getReserveTokensAddresses(assetInfos[i].tokenAddress)
          .call();
        const tokenContract = new web3.eth.Contract(
          IERC20Contract.abi as AbiItem[],
          addresses.aTokenAddress
        );
        const amountInTokenUnit = weiToTokenUnit(
          amounts[i],
          Number(assetInfos[i].decimals)
        );
        const step: ApprovalStep = {
          label: `Approve aToken Transfer (a${assetSymbols[i]})`,
          description: `Approve contract to transfer ${formatEther(
            amounts[i]
          )} amount of ${assetSymbols[i]} aTokens on behalf of you.`,
          checkAllowance: () =>
            checkAllowance(tokenContract, amountInTokenUnit),
          approveAllowance: () =>
            approveAllowance(tokenContract, amountInTokenUnit),
        };
        steps.push(step);
      }
      setApprovalSteps(steps);
    }
  }, [web3, account, buildToBeReducedCollaterals, dataProvider]);

  const onPrepareRepay = React.useCallback(() => {
    if (targetTokenAmount.gt(0)) {
      buildApprovalSteps().then(() => {
        setExpanded(true);
      });
    } else {
      setExpanded(false);
    }
  }, [buildApprovalSteps, targetTokenAmount]);

  return (
    <div>
      <Button
        variant="outlined"
        size="small"
        disabled={maxTargetTokenAmount === 0 || !collateralList}
        onClick={handleClickOpen}
      >
        Deleverage
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
          DELEVERAGE A BORROW POSITION
        </BootstrapDialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={12}>
              <CollateralPane
                assets={collateralList}
                handleCollateralReduction={handleCollateralReducedAmountSelect}
              />
            </Grid>
            <Grid item xs={12} sm={9}>
              <TokenValueSlider
                label="Target Token Amount"
                targetToken={targetToken}
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
                groupLabel="Fees"
                buttonLable1="Pay by Collateral"
                buttonLable2="Pay by Ether"
                setSelectedValue={setPayFeeByCollateral}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography gutterBottom>
                {`Fees: ${
                  repayVars ? formatEther(repayVars.feeETH) : "--"
                } ether`}
              </Typography>
              <Typography gutterBottom>
                {`New Health Factor: ${
                  repayVars &&
                  BigNumber.from(repayVars.expectedHealthFactor).lt(
                    BigInt(1e22)
                  )
                    ? formatEther(repayVars.expectedHealthFactor)
                    : "--"
                }`}
              </Typography>
              <Typography gutterBottom>{errorMessage}</Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            autoFocus
            disabled={targetTokenAmount.lte(0) || !!errorMessage}
            onClick={onPrepareRepay}
          >
            prepare repay
          </Button>
        </DialogActions>
        <Collapse in={expanded}>
          <DialogContent>
            {approvalSteps && (
              <ApprovalStepper
                steps={approvalSteps}
                label="All set. Now repay your debts"
                action={handleDeleverage}
              />
            )}
          </DialogContent>
        </Collapse>
      </BootstrapDialog>
    </div>
  );
};

export default DeleverageDialog;
