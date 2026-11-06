// n8n Code node, runOnceForAllItems. SINK ADAPTER: never performs I/O. Captures the command and returns a stable fake provider id.
// Transport-layer dry run (decision D-S03): non-test recipients are rejected here, regardless of what upstream nodes decided.
const SINK_VERSION = '1.0-proposed';
function fakeId(key) {
  let h = 2166136261;
  for (let n = 0; n < key.length; n++) { h ^= key.charCodeAt(n); h = Math.imul(h, 16777619) >>> 0; }
  return 'fake_msg_' + h.toString(16).padStart(8, '0');
}
function isTestRecipient(channel, to) {
  if (typeof to !== 'string') return false;
  if (channel === 'email') return to.toLowerCase().endsWith('@invalid.example');
  return /^[+]1555010[0-9]{4}$/.test(to);
}
return $input.all().map((item) => {
  const cmd = item.json.command || {};
  if (item.json.policy && item.json.policy.decision !== 'allow') {
    return { json: { sink: { status: 'blocked_by_policy', sink_version: SINK_VERSION, reason: item.json.policy.reason } } };
  }
  if (!cmd.idempotency_key) throw new Error('idempotency_key required');
  if (!isTestRecipient(cmd.channel, cmd.to)) {
    return { json: { sink: { status: 'rejected_non_test_recipient', sink_version: SINK_VERSION, provider_id: null } } };
  }
  return { json: { sink: {
    status: 'captured', sink_version: SINK_VERSION, external_effect: false,
    provider_id: fakeId(cmd.idempotency_key), idempotency_key: cmd.idempotency_key,
    channel: cmd.channel, tenant_id: cmd.tenant_id, segments: cmd.channel === 'sms' ? Math.max(1, Math.ceil(String(cmd.body || '').length / 160)) : 0
  } } };
});
