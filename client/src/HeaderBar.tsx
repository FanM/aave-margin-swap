import React from "react";
import Web3 from "web3";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ExchangeIcon from "@mui/icons-material/CurrencyExchange";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert, { AlertProps } from "@mui/material/Alert";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { lightBlue, purple } from "@mui/material/colors";

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
  const { connector, activate, deactivate, active, error } =
    useWeb3React<Web3Provider>();
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
            <ExchangeIcon />
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
      {web3 && <AssetPanel web3={web3} />}
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
