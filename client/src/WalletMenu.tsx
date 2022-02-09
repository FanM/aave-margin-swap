import * as React from "react";
import { makeStyles, createStyles } from "@mui/styles";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";

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
};
export default function WalletMenu(props: WalletMenuProps) {
  const { account } = useWeb3React();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  function handleClick(event: React.MouseEvent<HTMLElement>) {
    setAnchorEl(event.currentTarget);
  }
  const classes = useStyles();

  function handleClose() {
    setAnchorEl(null);
  }

  return (
    <div>
      <Button
        className={classes.button}
        aria-controls="customized-menu"
        aria-haspopup="true"
        onClick={handleClick}
      >
        {account
          ? `${account.substring(0, 6)}...${account.substring(
              account.length - 4
            )}`
          : "Connect Wallet"}
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
        {!props.active &&
          Object.keys(connectorsByName).map((c: any, index: number) => (
            <MenuItem
              key={index}
              onClick={() => {
                props.activateConnector(connectorsByName[c as ConnectorNames]);
                setAnchorEl(null);
              }}
            >
              <ListItemText primary={c} />
            </MenuItem>
          ))}
        {props.active && (
          <MenuItem
            onClick={() => {
              props.deactivateConnector();
              setAnchorEl(null);
            }}
          >
            <ListItemText primary={"Disconnect"} />
          </MenuItem>
        )}
      </Menu>
    </div>
  );
}
