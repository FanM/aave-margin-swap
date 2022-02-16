import * as React from "react";
import { styled } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Slider from "@mui/material/Slider";
import MuiInput from "@mui/material/Input";

import { BigNumber } from "ethers";
import { AssetPosition } from "./types";

const ETHER_DECIMALS = 18;

const Input = styled(MuiInput)`
  width: 120px;
`;

type TokenValueSliderProps = {
  targetToken: AssetPosition | undefined;
  maxAmount: number | undefined;
  setTokenValue: (value: BigNumber) => void;
};

const TokenValueSlider: React.FC<TokenValueSliderProps> = ({
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

  React.useEffect(() => {
    if (typeof value === "number" || typeof value === "string") {
      const valueStr = value.toString();
      const pos = valueStr.indexOf(".");
      const decimals = pos === -1 ? 0 : valueStr.length - pos - 1;
      let tokenValue = BigNumber.from(valueStr.replace(".", ""));
      for (let i = 0; i < ETHER_DECIMALS - decimals; i++)
        tokenValue = tokenValue.mul(10);
      setTokenValue(tokenValue);
    }
  }, [setTokenValue, value]);

  const handleSliderChange = (event: Event, newValue: number | number[]) => {
    setValue(newValue);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    const valid = /^[0-9]+.?[0-9]{0,8}$/i.test(inputValue);
    if (valid) {
      setValue(Number(event.target.value));
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
            {`Target Token Amount (Max ${maxAmount} ${targetToken.symbol})`}
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
                  step: maxAmount / 100,
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
