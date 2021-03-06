import * as React from "react";
import Box from "@mui/material/Box";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import StepContent from "@mui/material/StepContent";
import LoadingButton from "@mui/lab/LoadingButton";
import Typography from "@mui/material/Typography";

export type ApprovalStep = {
  label: string;
  description: string;
  checkAllowance: () => Promise<boolean>;
  approveAllowance: () => Promise<void>;
};

type ApprovalStepperProps = {
  steps: ApprovalStep[];
  finalizeApproval: () => void;
};

const ApprovalStepper: React.FC<ApprovalStepperProps> = ({
  steps,
  finalizeApproval,
}) => {
  const [activeStep, setActiveStep] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const checkAllStepsApproved = async () => {
      let i = activeStep;
      for (; i < steps.length; i++) {
        const step = steps[i];
        if (!(await step.checkAllowance())) {
          if (activeStep !== i) setActiveStep(i);
          return;
        }
      }
      if (activeStep !== i) setActiveStep(i);
      finalizeApproval();
    };
    checkAllStepsApproved();
  }, [activeStep, steps, finalizeApproval]);

  const handleNext = () => {
    const step = steps[activeStep];
    setLoading(true);
    step
      .approveAllowance()
      .then(() => setActiveStep(activeStep + 1))
      .finally(() => setLoading(false));
  };

  return (
    <Box sx={{ maxWidth: 400 }}>
      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((step, index) => (
          <Step key={index}>
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
    </Box>
  );
};

export default ApprovalStepper;
