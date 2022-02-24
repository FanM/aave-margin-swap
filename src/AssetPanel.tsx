import * as React from "react";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import { AbiItem } from "web3-utils";
import { useWeb3React } from "@web3-react/core";
import { formatEther } from "@ethersproject/units";

import { makeStyles, createStyles } from "@mui/styles";
import { ClassNameMap } from "@mui/styles/withStyles";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import IconButton from "@mui/material/IconButton";
import GitHubIcon from "@mui/icons-material/GitHub";

import { AssetPosition } from "./types";
import { TOKEN_FIXED_PRECISION } from "./utils";
import LeverageDialog from "./LeverageDialog";
import DeleverageDialog from "./DeleverageDialog";
import AaveManagerContract from "./contracts/AaveLeveragedSwapManager.sol/AaveLeveragedSwapManager.json";

const useStyles = makeStyles(
  createStyles({
    tableHeader: {
      fontSize: 12,
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
  classes: ClassNameMap;
};

const CollateralPane: React.FC<AssetPaneProps> = ({ assets, classes }) => {
  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 350 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell className={classes.tableHeader}>
              <strong>COLLATERAL</strong>
            </TableCell>
            <TableCell className={classes.tableHeader} align="right">
              <strong>AMOUNT</strong>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {assets &&
            assets.map((asset, index) => (
              <TableRow
                key={index}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {asset.symbol}
                </TableCell>
                <TableCell align="right">
                  {Number(formatEther(asset.aTokenBalance)).toFixed(
                    TOKEN_FIXED_PRECISION
                  )}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

type DebtPaneProps = {
  web3: Web3;
  aaveManager: Contract | undefined;
  account: string | null | undefined;
  debts: AssetPosition[] | undefined;
  collaterals: AssetPosition[] | undefined;
  classes: ClassNameMap;
};

const DebtPane: React.FC<DebtPaneProps> = ({
  web3,
  aaveManager,
  account,
  debts,
  collaterals,
  classes,
}) => {
  return (
    <TableContainer component={Paper}>
      <Table sx={{ m: 1, minWidth: 350 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell className={classes.tableHeader}>
              <strong>LOAN</strong>
            </TableCell>
            <TableCell className={classes.tableHeader} align="right">
              <strong>STABLE DEBT</strong>
            </TableCell>
            <TableCell className={classes.tableHeader} align="right">
              <strong>VARIABLE DEBT</strong>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {aaveManager &&
            account &&
            debts &&
            debts.map((asset: AssetPosition, index: number) => (
              <TableRow
                key={index}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {asset.symbol}
                </TableCell>
                <TableCell align="right">
                  <Grid container spacing={2}>
                    <Grid item xs={12} lg={6}>
                      {Number(formatEther(asset.stableDebt)).toFixed(
                        TOKEN_FIXED_PRECISION
                      )}
                    </Grid>
                    <Grid item xs={12} lg={6}>
                      <DeleverageDialog
                        web3={web3}
                        aaveManager={aaveManager}
                        account={account}
                        collateralList={collaterals}
                        targetToken={asset}
                        maxTargetTokenAmount={Number(
                          formatEther(asset.stableDebt)
                        )}
                        borrowRateMode={1}
                      />
                    </Grid>
                  </Grid>
                </TableCell>
                <TableCell align="right">
                  <Grid container spacing={2}>
                    <Grid item xs={12} lg={6}>
                      {Number(formatEther(asset.variableDebt)).toFixed(
                        TOKEN_FIXED_PRECISION
                      )}
                    </Grid>
                    <Grid item xs={12} lg={6}>
                      <DeleverageDialog
                        web3={web3}
                        aaveManager={aaveManager}
                        account={account}
                        collateralList={collaterals}
                        targetToken={asset}
                        maxTargetTokenAmount={Number(
                          formatEther(asset.variableDebt)
                        )}
                        borrowRateMode={2}
                      />
                    </Grid>
                  </Grid>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

type AssetPanelProps = {
  web3: Web3;
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
  }, [web3, account]);

  const handleGithubClick = () => {
    window.open(process.env.REACT_APP_GITHUB_LINK);
  };

  return (
    <div>
      <Grid
        justifyContent="center"
        textAlign="center"
        container
        sx={{ p: 1.5 }}
        spacing={2}
      >
        <Grid item sx={{ mt: 3, m: 1, p: 1 }} xs={12}>
          <Typography color="secondary">
            <em>
              <strong>
                CREATE YOUR LEVERAGED POSITIONS USING{" "}
                <Link href="https://aave.com/">AAVE</Link>
              </strong>
            </em>
          </Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <CollateralPane assets={userCollaterals} classes={classes} />
        </Grid>
        <Grid item xs={12} md={6}>
          <DebtPane
            web3={web3}
            aaveManager={aaveMgrContract}
            account={account}
            debts={userDebts}
            collaterals={userCollaterals}
            classes={classes}
          />
        </Grid>
        <Grid item xs={12}>
          {aaveMgrContract && account && assetList && (
            <LeverageDialog
              web3={web3}
              aaveManager={aaveMgrContract}
              account={account}
              assetList={assetList}
              disabled={!userCollaterals || userCollaterals.length === 0}
            />
          )}
        </Grid>
        <Grid item sx={{ m: 1, p: 1 }} xs={12}>
          <Typography sx={{ mt: 4 }}>
            <em>
              Currently only{" "}
              <Link href="https://polygon.technology/">Polygon</Link> network is
              supported, please read the user manual first on the Github page.
            </em>
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <IconButton onClick={handleGithubClick}>
            <GitHubIcon />
          </IconButton>
        </Grid>
      </Grid>
    </div>
  );
};

export default AssetPanel;
