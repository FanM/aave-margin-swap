import * as React from "react";
import { styled } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Slider from "@mui/material/Slider";
import MuiInput from "@mui/material/Input";

import { BigNumber } from "ethers";
import { parseEther } from "@ethersproject/units";

const Input = styled(MuiInput)`
  width: 120px;
`;

type TokenValueSliderProps = {
  maxAmount: number | undefined;
  setTokenValue: (value: BigNumber) => void;
};

const TokenValueSlider: React.FC<TokenValueSliderProps> = ({
  maxAmount,
  setTokenValue,
}) => {
  const [value, setValue] = React.useState<
    number | string | Array<number | string>
  >(0);

  React.useEffect(() => {
    if (typeof value === "number" || typeof value === "string") {
      setTokenValue(parseEther(value.toString()));
    }
  }, [setTokenValue, value]);

  const handleSliderChange = (event: Event, newValue: number | number[]) => {
    setValue(newValue);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value === "" ? 0 : Number(event.target.value));
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
      {maxAmount && (
        <div>
          <Typography id="input-slider" gutterBottom>
            {`Target Token Amount (Max ${maxAmount})`}
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
