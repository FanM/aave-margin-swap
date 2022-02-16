import * as React from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import StepContent from "@mui/material/StepContent";
import LoadingButton from "@mui/lab/LoadingButton";
import Typography from "@mui/material/Typography";

import { BigNumber } from "ethers";
import { Contract } from "web3-eth-contract";

export type ApprovalStep = {
  label: string;
  description: string;
  tokenAddress: string;
  tokenAmount: BigNumber;
  tokenContract: Contract;
};

type ApprovalStepperProps = {
  steps: ApprovalStep[];
  label: string;
  action: () => Promise<void>;
  account: string | null | undefined;
};

const ApprovalStepper: React.FC<ApprovalStepperProps> = ({
  steps,
  label,
  action,
  account,
}) => {
  const [activeStep, setActiveStep] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const getActiveStep = async () => {
      let i = 0;
      for (i = 0; i < steps.length; i++) {
        const step = steps[i];
        const balance: string = await step.tokenContract.methods
          .borrowAllowance(account, process.env.REACT_APP_DEPLOYED_CONTRACT)
          .call();
        if (BigNumber.from(balance).lt(step.tokenAmount)) {
          setActiveStep(i);
          return;
        }
      }
      setActiveStep(i);
    };
    if (account) {
      getActiveStep();
    }
  }, [steps, account]);

  const handleNext = () => {
    const step = steps[activeStep];
    setLoading(true);
    step.tokenContract.methods
      .approveDelegation(
        process.env.REACT_APP_DEPLOYED_CONTRACT,
        step.tokenAmount
      )
      .send({ from: account })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleSubmit = () => {
    setLoading(true);
    action()
      .then()
      .finally(() => setLoading(false));
  };

  return (
    <Box sx={{ maxWidth: 400 }}>
      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((step, index) => (
          <Step key={step.label}>
            <StepLabel>{step.label}</StepLabel>
            <StepContent>
              <Typography>{step.description}</Typography>
              <Box sx={{ mb: 2 }}>
                <div>
                  <LoadingButton
                    loading={loading}
                    variant="contained"
                    onClick={handleNext}
                    disabled={index !== activeStep}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Approve
                  </LoadingButton>
                </div>
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>
      {activeStep === steps.length && (
        <Paper square elevation={0} sx={{ p: 3 }}>
          <Typography>{label}</Typography>
          <LoadingButton
            loading={loading}
            variant="contained"
            onClick={handleSubmit}
            sx={{ mt: 1, mr: 1 }}
          >
            sumbit
          </LoadingButton>
        </Paper>
      )}
    </Box>
  );
};

export default ApprovalStepper;
