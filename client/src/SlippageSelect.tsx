import * as React from "react";
import { BigNumber } from "ethers";

import Box from "@mui/material/Box";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select, { SelectChangeEvent } from "@mui/material/Select";

export const SLIPPAGE_BASE_UINT = BigNumber.from(100);

type SlippageSelectProps = {
  slippage: number | undefined;
  slippageOptions: number[];
  selectSlippage: (slippage: number) => void;
  label: string;
};
const SlippageSelect: React.FC<SlippageSelectProps> = ({
  slippage,
  slippageOptions,
  selectSlippage,
  label,
}) => {
  const handleSlippageSelect = (event: SelectChangeEvent) => {
    selectSlippage(Number(event.target.value));
  };

  return (
    <Box sx={{ maxWidth: 80 }}>
      {slippage && (
        <FormControl fullWidth>
          <InputLabel id="token-select-label">{label}</InputLabel>
          <Select
            labelId="token-select-label"
            id="token-select"
            value={slippage.toString()}
            label={label}
            onChange={handleSlippageSelect}
          >
            {slippageOptions.map((s, index) => (
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

export default SlippageSelect;
