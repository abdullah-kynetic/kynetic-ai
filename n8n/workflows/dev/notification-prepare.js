// n8n runOnceForAllItems. KIND is supplied by the workflow, never by incoming lead data.
// Gate snapshots are stub inputs only: no snapshot is a permit for a real send.
const testPhone = $env.TEST_PHONE;
if (typeof testPhone !== 'string' || !/^\+[1-9]\d{7,14}$/.test(testPhone)) {
  throw new Error('TEST_PHONE must be configured; no recipient fallback');
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const now = Date.now();
const output = [];
for (const item of $input.all()) {
  const envelope = item.json.body ?? item.json;
  // Native portal envelopes carry event-specific fields in payload; root identity wins.
  const event = { ...(envelope.payload ?? {}), ...envelope };
  if (event.synthetic !== true) throw new Error('Synthetic events only');
  if (!uuid.test(event.id ?? '') || !uuid.test(event.tenantId ?? '')) throw new Error('Stable event and tenant UUIDs required');
  let action;
  let recordId;
  if (KIND === 'missed-call') {
    if (event.name !== 'call.completed' || event.direction !== 'inbound' || !['no_answer', 'voicemail'].includes(event.outcome)) continue;
    action = 'textback'; recordId = event.callId;
  } else if (KIND === 'reminder') {
    if (!['appointment.booked', 'appointment.reminder_due'].includes(event.name) || event.bookingStatus !== 'confirmed') continue;
    action = event.name === 'appointment.booked' ? 'confirmation' : 'reminder';
    recordId = event.appointmentId;
    if (action === 'reminder') {
      const due = Date.parse(event.dueAt);
      const expires = Date.parse(event.expiresAt);
      if (!Number.isFinite(due) || !Number.isFinite(expires) || due >= expires) throw new Error('Reminder due/expiry times required');
      if (now < due || now >= expires) continue;
    }
  } else if (KIND === 'owner-alert') {
    if (event.name === 'call.completed' && ['booked', 'qualified'].includes(event.outcome)) recordId = event.callId;
    else if (event.name === 'lead.created') recordId = event.contactId;
    else if (event.name === 'appointment.booked' && event.bookingStatus === 'confirmed') recordId = event.appointmentId;
    else continue;
    action = 'owner-alert';
  } else if (KIND === 'error-alert') {
    if (event.name !== 'workflow.failed') continue;
    if (event.originWorkflowId === $workflow.id) continue; // suppress recursive alerts
    action = 'error-alert'; recordId = event.id;
  } else throw new Error('Unsupported notification kind');
  if (!uuid.test(recordId ?? '')) throw new Error('Stable record UUID required');
  const base = { synthetic: true, mode: 'stub', action, tenantId: event.tenantId,
    idempotencyKey: `dev:${event.tenantId}:${KIND}:${recordId}:${action}`,
    dispatch_enabled: false, requires_server_recheck: true };
  if (event.gate?.allowed !== true) {
    // Never echo provider errors, arbitrary messages, phone numbers or credentials.
    const quiet = event.gate?.reason === 'quiet_hours';
    output.push({ json: { ...base, status: quiet ? 'deferred' : 'blocked', reason: quiet ? 'quiet_hours' : 'portal_gate_denied_or_missing' } });
    continue;
  }
  const messages = {
    textback: 'DEV SIMULATION: missed-call textback preview. No real message was sent.',
    confirmation: 'DEV SIMULATION: booking confirmation preview. No real reservation or message.',
    reminder: 'DEV SIMULATION: appointment reminder preview. No real message was sent.',
    'owner-alert': 'DEV SIMULATION: client activity alert preview. Review the dev portal.',
    'error-alert': 'DEV SIMULATION: workflow failure alert preview. Review private diagnostics locally.'
  };
  output.push({ json: { ...base, status: 'stub_preview', request: { To: '{{TEST_PHONE}}', Body: messages[action] } } });
}
return output;
