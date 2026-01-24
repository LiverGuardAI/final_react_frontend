export type PatientStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';

/**
 * Maps the backend workflow_state to the simplified frontend patient status.
 * @param workflowState - The workflow state from the backend (e.g., 'WAITING_CLINIC', 'IN_CLINIC')
 * @returns 'WAITING' | 'IN_PROGRESS' | 'COMPLETED'
 */
export const mapWorkflowStateToStatus = (workflowState: string): PatientStatus => {
    if (workflowState === 'WAITING_CLINIC' || workflowState === 'WAITING_ADDITIONAL_CLINIC') {
        return 'WAITING';
    } else if (workflowState === 'IN_CLINIC' || workflowState === 'WAITING_RESULTS' || workflowState === 'WAITING_PAYMENT' || workflowState === 'WAITING_ORDER' || workflowState === 'WAITING_IMAGING' || workflowState === 'IN_IMAGING') {
        return 'IN_PROGRESS';
    } else if (workflowState === 'COMPLETED') {
        return 'COMPLETED';
    }
    // Default fallback
    return 'WAITING';
};
