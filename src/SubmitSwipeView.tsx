import * as React from "react";

import Button from "@mui/material/Button";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Typography from "@mui/material/Typography";
import LoadingButton from "@mui/lab/LoadingButton";
import DoneIcon from "@mui/icons-material/Done";

import ApprovalStepper, { ApprovalStep } from "./ApprovalStepper";

type SubmitSwipeViewProps = {
  keyStr: string;
  approvalSteps: ApprovalStep[] | undefined;
  errorMessage: string | undefined;
  loading: boolean;
  readyToSwap: boolean;
  swapSucceeded: boolean;
  handleSubmit: () => void;
  finalizeApproval: () => void;
  setStep: (i: number) => void;
};

const SubmitSwipeView: React.FC<SubmitSwipeViewProps> = ({
  keyStr,
  approvalSteps,
  errorMessage,
  loading,
  readyToSwap,
  swapSucceeded,
  handleSubmit,
  finalizeApproval,
  setStep,
}) => (
  <div key={keyStr}>
    <DialogContent dividers>
      {approvalSteps && (
        <ApprovalStepper
          steps={approvalSteps}
          finalizeApproval={finalizeApproval}
        />
      )}
      <Typography color="error" gutterBottom>
        {errorMessage}
      </Typography>
    </DialogContent>
    <DialogActions>
      <LoadingButton
        disabled={!readyToSwap || swapSucceeded}
        loading={loading}
        onClick={handleSubmit}
      >
        {swapSucceeded ? <DoneIcon /> : "sumbit"}
      </LoadingButton>
      <Button disabled={loading || swapSucceeded} onClick={() => setStep(0)}>
        back
      </Button>
    </DialogActions>
  </div>
);

export default SubmitSwipeView;
