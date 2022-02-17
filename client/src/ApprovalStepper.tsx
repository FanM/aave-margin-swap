import * as React from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
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
  label: string;
  action: () => Promise<void>;
};

const ApprovalStepper: React.FC<ApprovalStepperProps> = ({
  steps,
  label,
  action,
}) => {
  const [activeStep, setActiveStep] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const getActiveStep = async () => {
      let i = 0;
      for (i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!(await step.checkAllowance())) {
          setActiveStep(i);
          return;
        }
      }
      setActiveStep(i);
    };
    getActiveStep();
  }, [steps]);

  const handleNext = () => {
    const step = steps[activeStep];
    setLoading(true);
    step.approveAllowance().finally(() => {
      setLoading(false);
      setActiveStep(activeStep + 1);
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
