// Run Once for All Items. Maps a verified ElevenLabs post-call payload onto the portal's call-result
// body (POST /api/service/call-results). The portal re-validates everything; unknown outcomes become "other".
// Needs NODE_FUNCTION_ALLOW_BUILTIN=crypto (the same setting the signature check needs).
const crypto = require('crypto');
const OUTCOMES = ['booked', 'qualified', 'not_interested', 'voicemail', 'no_answer', 'transferred', 'dnc', 'other'];
const body = $input.first().json.body || {};
const data = body.data || {};
const meta = data.metadata || {};
const analysis = data.analysis || {};
const collected = (analysis.data_collection_results || {});
const rawOutcome = String((collected.outcome && collected.outcome.value) || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const contactId = (data.conversation_initiation_client_data || {}).dynamic_variables?.contact_id;
const started = new Date((meta.start_time_unix_secs || body.event_timestamp || 0) * 1000).toISOString();
function uuidFrom(text) {
  const h = crypto.createHash('sha256').update(text).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
if (!contactId || !data.conversation_id || !data.agent_id) {
  return [{ json: { skip: true, reason: 'missing contact_id, conversation_id or agent_id' } }];
}
return [{
  json: {
    skip: false,
    request: {
      // Deterministic, so a retried delivery of the same call is the same event and the portal dedupes it.
      eventId: uuidFrom(String(data.conversation_id)),
      version: 1,
      occurredAt: started,
      payload: {
        contactId,
        provider: 'elevenlabs',
        providerCallId: String(data.conversation_id),
        agentId: String(data.agent_id),
        direction: 'outbound',
        startedAt: started,
        durationS: Math.max(0, Math.round(meta.call_duration_secs || 0)),
        outcome: OUTCOMES.includes(rawOutcome) ? rawOutcome : 'other',
        summary: analysis.transcript_summary ? String(analysis.transcript_summary).slice(0, 5000) : undefined
      }
    }
  }
}];
