import * as React from "react";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import { AbiItem } from "web3-utils";
import { useWeb3React } from "@web3-react/core";
import { formatEther } from "@ethersproject/units";

import { makeStyles, createStyles } from "@mui/styles";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

import { AssetPosition } from "./types";
import LeverageDialog from "./LeverageDialog";
import AaveManagerContract from "./contracts/AaveLeveragedSwapManager.sol/AaveLeveragedSwapManager.json";

const useStyles = makeStyles(
  createStyles({
    button: {
      color: "white",
    },
    paper: {
      backgroundColor: "#cccccc",
      color: "white",
    },
    list: {
      color: "white",
      hoverColor: "green",
    },
  })
);

type AssetPaneProps = {
  assets: AssetPosition[] | undefined;
};

const CollateralPane = (props: AssetPaneProps) => {
  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 350 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Collateral</TableCell>
            <TableCell align="right">Amount</TableCell>
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
                  {formatEther(asset.aTokenBalance)}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const DebtPane = (props: AssetPaneProps) => {
  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 350 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Asset</TableCell>
            <TableCell align="right">Stable Debt</TableCell>
            <TableCell align="right">Variable Debt</TableCell>
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
                  {formatEther(asset.stableDebt)}
                </TableCell>
                <TableCell align="right">
                  {formatEther(asset.variableDebt)}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

type AssetPanelProps = {
  web3: Web3 | undefined;
};
const AssetPanel: React.FC<AssetPanelProps> = ({ web3 }) => {
  const classes = useStyles();

  const [aaveMgrContract, setAaveMgrContract] = React.useState<Contract>();
  const { account } = useWeb3React();
  const [assetList, setAssetList] = React.useState<AssetPosition[]>();
  const [userCollaterals, setUserCollaterals] =
    React.useState<AssetPosition[]>();
  const [userDebts, setUserDebts] = React.useState<AssetPosition[]>();

  React.useEffect(() => {
    if (web3) {
      const aaveManager = new web3.eth.Contract(
        AaveManagerContract.abi as AbiItem[],
        process.env.REACT_APP_DEPLOYED_CONTRACT
      );
      aaveManager.methods
        .getAssetPositions()
        .call({ from: account })
        .then((assets: AssetPosition[]) => {
          setAssetList(assets);
          setUserCollaterals(
            assets.filter(
              (asset) =>
                asset.usedAsCollateral &&
                BigInt(asset.aTokenBalance.toString()) > 0
            )
          );
          setUserDebts(
            assets.filter(
              (asset) =>
                BigInt(asset.stableDebt.toString()) > 0 ||
                BigInt(asset.variableDebt.toString()) > 0
            )
          );
        });
      setAaveMgrContract(aaveManager);
    } else {
      console.log("No web3!");
    }
  }, [web3, account]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6}>
        <CollateralPane assets={userCollaterals} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DebtPane assets={userDebts} />
      </Grid>
      <Grid item>
        <LeverageDialog
          web3={web3}
          aaveManager={aaveMgrContract}
          account={account}
          assetList={assetList}
        />
      </Grid>
    </Grid>
  );
};

export default AssetPanel;
