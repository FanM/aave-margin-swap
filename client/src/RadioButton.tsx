import * as React from "react";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";

type RadioButtonsGroupProps = {
  groupLabel: string;
  buttonLable1: string;
  buttonLable2: string;
  setSelectedValue: (value: boolean) => void;
  secondOptionDisabled?: boolean;
};
const RadioButtonsGroup: React.FC<RadioButtonsGroupProps> = ({
  groupLabel,
  buttonLable1,
  buttonLable2,
  setSelectedValue,
  secondOptionDisabled = false,
}) => {
  const [value, setValue] = React.useState<boolean>(true);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = (event.target as HTMLInputElement).value === "true";
    setValue(newValue);
    setSelectedValue(newValue);
  };

  return (
    <FormControl>
      <FormLabel id="controlled-radio-buttons-group">{groupLabel}</FormLabel>
      <RadioGroup
        aria-labelledby="controlled-radio-buttons-group"
        name="controlled-radio-buttons-group"
        value={value}
        onChange={handleChange}
      >
        <FormControlLabel
          value="true"
          control={<Radio />}
          label={buttonLable1}
        />
        <FormControlLabel
          value="false"
          control={<Radio />}
          label={buttonLable2}
          disabled={secondOptionDisabled}
        />
      </RadioGroup>
    </FormControl>
  );
};

export default RadioButtonsGroup;
