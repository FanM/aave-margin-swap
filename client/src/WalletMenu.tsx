import * as React from "react";
import { makeStyles, createStyles } from "@mui/styles";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Badge from "@mui/material/Badge";

import { AbstractConnector } from "@web3-react/abstract-connector";
import { useWeb3React } from "@web3-react/core";

import { injected, walletconnect } from "./connectors";

enum ConnectorNames {
  Injected = "Browser Wallet",
  WalletConnect = "WalletConnect",
}

const connectorsByName: {
  [connectorName in ConnectorNames]: AbstractConnector;
} = {
  [ConnectorNames.Injected]: injected,
  [ConnectorNames.WalletConnect]: walletconnect,
};

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

type WalletMenuProps = {
  active: boolean;
  activateConnector: (
    connector: AbstractConnector,
    onError?: (error: Error) => void,
    throwErrors?: boolean
  ) => Promise<void>;
  deactivateConnector: () => void;
  connector: AbstractConnector | undefined;
};

const WalletMenu: React.FC<WalletMenuProps> = ({
  active,
  activateConnector,
  deactivateConnector,
  connector,
}) => {
  const { account } = useWeb3React();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  function handleClick(event: React.MouseEvent<HTMLElement>) {
    setAnchorEl(event.currentTarget);
  }
  const classes = useStyles();

  function handleClose() {
    setAnchorEl(null);
  }

  const activate = React.useCallback(
    (name: ConnectorNames) => {
      activateConnector(connectorsByName[name]);
      setAnchorEl(null);
    },
    [activateConnector]
  );

  const deactivate = React.useCallback(() => {
    if (connector === connectorsByName[ConnectorNames.WalletConnect]) {
      (connector as any).close();
    } else {
      deactivateConnector();
    }
    setAnchorEl(null);
  }, [deactivateConnector, connector]);

  return (
    <div>
      <Button
        className={classes.button}
        aria-controls="customized-menu"
        aria-haspopup="true"
        onClick={handleClick}
      >
        {account ? (
          `${account.substring(0, 6)}...${account.substring(
            account.length - 4
          )}`
        ) : (
          <Badge
            sx={{ m: 1, p: 0.45 }}
            badgeContent={
              <Typography sx={{ fontSize: 8 }}>
                <em>POLYGON</em>
              </Typography>
            }
            color="secondary"
          >
            Connect Wallet
          </Badge>
        )}
      </Button>
      <Menu
        classes={{
          paper: classes.paper,
          list: classes.list,
        }}
        elevation={0}
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
      >
        {!active &&
          Object.keys(connectorsByName).map((c: any, index: number) => (
            <MenuItem
              key={index}
              onClick={() => {
                activate(c as ConnectorNames);
              }}
            >
              <ListItemText primary={c} />
            </MenuItem>
          ))}
        {active && (
          <MenuItem onClick={deactivate}>
            <ListItemText primary={"Disconnect"} />
          </MenuItem>
        )}
      </Menu>
    </div>
  );
};

export default WalletMenu;
