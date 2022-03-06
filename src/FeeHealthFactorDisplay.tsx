import * as React from "react";
import { BigNumber } from "ethers";
import { formatEther } from "@ethersproject/units";

import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

import {
  TOKEN_FIXED_PRECISION,
  HEALTH_FACTOR_FIXED_PRECISION,
  NATIVE_TOKEN_SYMBOL,
} from "./utils";

type FeeHealthFactorProps = {
  fees: BigNumber[] | undefined;
  healthFactor: number | undefined;
  errorMessage: String | undefined;
  loading: Boolean;
};

const FeeHealthFactorDisplay: React.FC<FeeHealthFactorProps> = ({
  fees,
  healthFactor,
  errorMessage,
  loading,
}) => (
  <Grid container spacing={2}>
    <Grid item xs={12}>
      <Typography color="warning.light" gutterBottom>
        Estimated Fees:{" "}
        {loading ? (
          <CircularProgress size={15} />
        ) : (
          <strong>
            {" "}
            {fees
              ? Number(formatEther(fees[0])).toFixed(TOKEN_FIXED_PRECISION)
              : "--"}
          </strong>
        )}{" "}
        ETH{" "}
        {!loading && fees && fees.length > 1 && (
          <span>
            (
            <strong>
              {Number(formatEther(fees[1])).toFixed(TOKEN_FIXED_PRECISION)}{" "}
            </strong>
            {NATIVE_TOKEN_SYMBOL})
          </span>
        )}
      </Typography>
    </Grid>
    <Grid item xs={12} sm={6}>
      <Typography color="warning.light" gutterBottom>
        New Health Factor:{" "}
        {loading ? (
          <CircularProgress size={10} />
        ) : (
          <strong>
            {healthFactor
              ? `${
                  healthFactor <= 1e7
                    ? healthFactor.toFixed(HEALTH_FACTOR_FIXED_PRECISION)
                    : "--"
                }`
              : "--"}
          </strong>
        )}
      </Typography>
    </Grid>
    <Grid item xs={12} sm={6}>
      <Typography color="error" gutterBottom>
        {errorMessage}
      </Typography>
    </Grid>
  </Grid>
);

export default FeeHealthFactorDisplay;
