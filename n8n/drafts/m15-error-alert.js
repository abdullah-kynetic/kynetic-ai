// M15-04 draft Code node, Run Once for All Items. No I/O, credentials or raw error data.
// Only execution failures with durable workflow/execution IDs are supported in this draft.
const input = $input.first()?.json;
const identifier = (value) => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : null;
};
const workflowId = identifier(input?.workflow?.id);
const executionId = identifier(input?.execution?.id);
if (!workflowId || !executionId) throw new Error('Workflow failure needs stable workflow and execution IDs.');
// The alert workflow must never configure itself as its own error handler.
if (workflowId === identifier($workflow.id)) return [];
const idempotencyKey = `n8n-error:${workflowId}:${executionId}`;
return [{ json: {
  idempotencyKey,
  workflowId,
  executionId,
  subject: 'Kynetic workflow execution failed',
  text: `Workflow ${workflowId}, execution ${executionId} failed. Review the execution in n8n. Raw error details are deliberately omitted.`
} }];
