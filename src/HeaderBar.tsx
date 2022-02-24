import React from "react";
import Web3 from "web3";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert, { AlertProps } from "@mui/material/Alert";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { lightBlue, purple } from "@mui/material/colors";
import { createSvgIcon } from "@mui/material/utils";

import {
  Web3ReactProvider,
  useWeb3React,
  UnsupportedChainIdError,
} from "@web3-react/core";
import {
  NoEthereumProviderError,
  UserRejectedRequestError as UserRejectedRequestErrorInjected,
} from "@web3-react/injected-connector";
import { UserRejectedRequestError as UserRejectedRequestErrorWalletConnect } from "@web3-react/walletconnect-connector";
import { Web3Provider } from "@ethersproject/providers";

import { useEagerConnect, useInactiveListener } from "./hooks";
import WalletMenu from "./WalletMenu";
import AssetPanel from "./AssetPanel";

const LogoIcon = createSvgIcon(
  <path d="M19.375 15.103A8.001 8.001 0 0 0 8.03 5.053l-.992-1.737A9.996 9.996 0 0 1 17 3.34c4.49 2.592 6.21 8.142 4.117 12.77l1.342.774l-4.165 2.214l-.165-4.714l1.246.719zM4.625 8.897a8.001 8.001 0 0 0 11.345 10.05l.992 1.737A9.996 9.996 0 0 1 7 20.66C2.51 18.068.79 12.518 2.883 7.89L1.54 7.117l4.165-2.214l.165 4.714l-1.246-.719zm8.79 5.931L10.584 12l-2.828 2.828l-1.414-1.414l4.243-4.242L13.414 12l2.829-2.828l1.414 1.414l-4.243 4.242z" />,
  "Home"
);

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  props,
  ref
) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

function getErrorMessage(error: Error) {
  if (error instanceof NoEthereumProviderError) {
    return "No Ethereum browser extension detected, install MetaMask on desktop or visit from a dApp browser on mobile.";
  } else if (error instanceof UnsupportedChainIdError) {
    return "You're connected to an unsupported network.";
  } else if (
    error instanceof UserRejectedRequestErrorInjected ||
    error instanceof UserRejectedRequestErrorWalletConnect
  ) {
    return "Please authorize this website to access your Ethereum account.";
  } else {
    console.error(error);
    return "An unknown error occurred. Check the console for more details.";
  }
}
function getLibrary(provider: any): Web3Provider {
  const library = new Web3Provider(provider);
  library.pollingInterval = 12000;
  return library;
}

const colorTheme = createTheme({
  palette: {
    primary: {
      main: purple[800],
      contrastText: lightBlue[200],
    },
  },
});

const AppToolBar = () => {
  const { connector, activate, deactivate, active, error } = useWeb3React<
    Web3Provider
  >();
  const [web3, setWeb3] = React.useState<Web3>();
  const [open, setOpen] = React.useState(false);
  // handle logic to recognize the connector currently being activated
  React.useEffect(() => {
    if (active) {
      connector!.getProvider().then((p) => {
        setWeb3(new Web3(p));
      });
    }
    if (error) {
      setOpen(true);
    }
  }, [active, connector, error]);

  // handle logic to eagerly connect to the injected ethereum provider, if it exists and has granted access already
  const triedEager = useEagerConnect();
  // handle logic to connect in reaction to certain events on the injected ethereum provider, if it exists
  useInactiveListener(!triedEager);

  const handleErrorMsgClose = (
    event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") {
      return;
    }
    setOpen(false);
  };
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
          >
            <LogoIcon sx={{ fontSize: 40 }} />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            AAVE LEVERAGED SWAP
          </Typography>
          <WalletMenu
            active={active}
            activateConnector={activate}
            deactivateConnector={deactivate}
            connector={connector}
          />
        </Toolbar>
      </AppBar>
      <AssetPanel web3={web3} />
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleErrorMsgClose}
      >
        <Alert
          onClose={handleErrorMsgClose}
          severity="error"
          sx={{ width: "100%" }}
        >
          {error && getErrorMessage(error)}
        </Alert>
      </Snackbar>
    </Box>
  );
};
export default function HeaderBar() {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <ThemeProvider theme={colorTheme}>
        <AppToolBar />
      </ThemeProvider>
    </Web3ReactProvider>
  );
}
