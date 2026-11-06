// n8n Code node, runOnceForAllItems. Pure function: no I/O, no secrets, no Date.now().
// Input item.json: { tenant_id, environment, system, channel, now, contact, lease, config }
// Output item.json: { decision, reason, rule, evaluated_at, next_eligible_at, ... } (allow|defer|suppress|human_review)
// Proposed contract version 1.0-proposed. Rule order = spec section 4.1 priority (safety first).
const BLOCKED_OWNER_STATES = ['FL', 'OK'];
function localHour(iso, tz) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(iso));
  return Number(parts.find((p) => p.type === 'hour').value);
}
function validTz(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; }
}
function decide(i) {
  const out = (decision, reason, rule, extra) => Object.assign(
    { decision, reason, rule, evaluated_at: i.now, tenant_id: i.tenant_id, channel: i.channel, system: i.system }, extra || {});
  const c = i.contact || {};
  const cfg = i.config || {};
  if (!i.tenant_id || !i.now || !['sms', 'voice', 'email'].includes(i.channel)) {
    return out('human_review', 'invalid_input', 'input.validate');
  }
  // 1. Safety / suppression
  if (cfg.active !== true) return out('suppress', 'tenant_inactive', 'safety.tenant_active');
  if (!cfg.enabled || cfg.enabled[i.channel] !== true) return out('suppress', 'channel_disabled', 'safety.channel_enabled');
  if (i.environment === 'production' && cfg.production_activation_approved !== true) {
    return out('suppress', 'production_not_approved', 'safety.production_gate');
  }
  if (c.suppressed_global === true || c.suppressed_tenant === true) return out('suppress', 'suppressed', 'safety.suppression');
  if (c.dnc === true) return out('suppress', 'dnc', 'safety.dnc');
  if (c.opted_out && (c.opted_out[i.channel] === true || c.opted_out.all === true)) {
    return out('suppress', 'opted_out', 'safety.opt_out');
  }
  // Owner/business eligibility uses the owner state only, never the service address state.
  const ownerState = String(c.owner_state || '').trim().toUpperCase();
  if (!ownerState) return out('human_review', 'owner_state_unknown', 'safety.owner_eligibility');
  if (BLOCKED_OWNER_STATES.includes(ownerState)) return out('suppress', 'owner_ineligible', 'safety.owner_eligibility');
  // 2. Human ownership
  if (c.human_owned === true) return out('defer', 'human_owned', 'human.ownership');
  // Consent (restrictive default): no consent for this channel, no automated contact.
  const channels = (c.consent && c.consent.channels) || [];
  const wanted = i.channel === 'voice' ? 'phone_call' : i.channel;
  if (!channels.includes(wanted)) return out('suppress', 'no_consent', 'consent.channel');
  // 3. Lease (parallel campaign ownership)
  const l = i.lease;
  if (l && l.expires_at && Date.parse(l.expires_at) > Date.parse(i.now) &&
      !(l.system === i.system && l.conversation_id === i.conversation_id)) {
    return out('defer', 'lease_held', 'coordination.lease', { lease_holder: l.system, next_eligible_at: l.expires_at });
  }
  // 4. Quiet hours in the contact's verified timezone; unknown timezone = no automated send.
  if (!validTz(c.timezone)) return out('human_review', 'unknown_timezone', 'time.timezone');
  const q = cfg.quiet_hours || { start: 8, end: 21 };
  const inWindow = (iso) => { const h = localHour(iso, c.timezone); return h >= q.start && h < q.end; };
  if (!inWindow(i.now)) {
    let t = Date.parse(i.now);
    for (let n = 0; n < 192; n++) { // step 15 min, max 48h
      t += 15 * 60 * 1000;
      if (inWindow(new Date(t).toISOString())) return out('defer', 'quiet_hours', 'time.quiet_hours', { next_eligible_at: new Date(t).toISOString() });
    }
    return out('human_review', 'no_send_window', 'time.quiet_hours');
  }
  return out('allow', 'all_checks_passed', 'allow');
}
return $input.all().map((item) => ({ json: Object.assign({}, item.json, { policy: decide(item.json) }) }));
