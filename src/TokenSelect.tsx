import * as React from "react";

import Box from "@mui/material/Box";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select, { SelectChangeEvent } from "@mui/material/Select";

import { AssetPosition } from "./types";

type TokenSelectProps = {
  assets: AssetPosition[] | undefined;
  tokenAddress: string | undefined;
  selectToken: (tokenAddress: string) => void;
  label: string;
};

const TokenSelect: React.FC<TokenSelectProps> = ({
  assets,
  tokenAddress,
  selectToken,
  label,
}) => {
  const handleTokenSelect = (event: SelectChangeEvent) => {
    selectToken(event.target.value);
  };

  return (
    <Box sx={{ minWidth: 120 }}>
      {assets && tokenAddress && (
        <FormControl fullWidth>
          <InputLabel id="token-select-label">{label}</InputLabel>
          <Select
            labelId="token-select-label"
            id="token-select"
            value={tokenAddress}
            label={label}
            onChange={handleTokenSelect}
          >
            {assets.map((asset, index) => (
              <MenuItem key={index} value={asset.token}>
                {asset.symbol}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Box>
  );
};

export default TokenSelect;
