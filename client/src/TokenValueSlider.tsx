import * as React from "react";
import { styled } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Slider from "@mui/material/Slider";
import MuiInput from "@mui/material/Input";

import { BigNumber } from "ethers";
import { AssetPosition } from "./types";
import { WEI_DECIMALS, TOKEN_FIXED_PRECISION } from "./utils";

const INPUT_NUMBER_REGEX = `^[0-9]+(\\.[0-9]{1,${TOKEN_FIXED_PRECISION}})?$`;

const Input = styled(MuiInput)`
  width: 120px;
`;

type TokenValueSliderProps = {
  label: string;
  targetToken: AssetPosition | undefined;
  maxAmount: number | undefined;
  setTokenValue: (value: BigNumber) => void;
};

const TokenValueSlider: React.FC<TokenValueSliderProps> = ({
  label,
  targetToken,
  maxAmount,
  setTokenValue,
}) => {
  const [value, setValue] = React.useState<
    number | string | Array<number | string>
  >(0);
  const [inputError, setInputError] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (targetToken) setValue(0);
  }, [targetToken]);

  const updateTokenValue = (value: number | number[] | string | string[]) => {
    if (typeof value === "number" || typeof value === "string") {
      const valueStr = value.toString();
      if (valueStr.indexOf("e") !== -1) {
        // don't process exponential format
        return;
      }
      const pos = valueStr.indexOf(".");
      let tokenValue: string;
      if (pos === -1) {
        // an integer, pad ETHER_DECIMALS of 0 to the end
        tokenValue = valueStr.padEnd(valueStr.length + WEI_DECIMALS, "0");
      } else {
        // a float
        tokenValue = valueStr.replace(".", "");
        const decimals = valueStr.length - pos - 1;
        // pad 0 until the fraction part reaches the length of ETHER_DECIMALS
        tokenValue = tokenValue.padEnd(pos + WEI_DECIMALS, "0");
        if (decimals > WEI_DECIMALS) {
          // if the length of the fraction part exceeds ETHER_DECIMALS, truncate it
          tokenValue = tokenValue.substring(0, pos + WEI_DECIMALS);
        }
      }
      setTokenValue(BigNumber.from(tokenValue));
    }
  };

  const handleSliderChange = (event: Event, newValue: number | number[]) => {
    if (typeof newValue === "number") {
      setValue(newValue.toFixed(TOKEN_FIXED_PRECISION));
      updateTokenValue(newValue);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;

    const valid = inputValue.match(INPUT_NUMBER_REGEX);
    if (valid) {
      setValue(Number(inputValue));
      updateTokenValue(inputValue);
      setInputError(false);
    } else {
      setInputError(true);
    }
  };

  const handleBlur = () => {
    if (value < 0) {
      setValue(0);
    } else if (value > maxAmount!) {
      setValue(maxAmount!);
    }
  };

  return (
    <Box sx={{ width: 450 }}>
      {maxAmount && targetToken && (
        <div>
          <Typography id="input-slider" gutterBottom>
            {label} Max (
            <strong>{maxAmount.toFixed(TOKEN_FIXED_PRECISION)}</strong>{" "}
            {targetToken.symbol})
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={5} sm={4}>
              <Slider
                value={
                  typeof value === "number" || typeof value === "string"
                    ? Number(value)
                    : 0
                }
                onChange={handleSliderChange}
                step={maxAmount / 100}
                max={maxAmount}
                aria-labelledby="input-slider"
              />
            </Grid>
            <Grid item xs={7} sm={8}>
              <Input
                value={value}
                size="small"
                onChange={handleInputChange}
                onBlur={handleBlur}
                error={inputError}
                inputProps={{
                  step: (maxAmount / 100).toFixed(TOKEN_FIXED_PRECISION),
                  min: 0,
                  max: maxAmount,
                  type: "number",
                  "aria-labelledby": "input-slider",
                }}
              />
            </Grid>
          </Grid>
        </div>
      )}
    </Box>
  );
};

export default TokenValueSlider;
