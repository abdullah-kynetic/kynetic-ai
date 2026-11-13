// n8n Code node ("Run Once for Each Item"). Turns a validated website contact form submission into a
// signed request for the portal lead endpoint (POST /api/hooks/leads/<tenant id>, DC-073).
// Input item: name, email, message, received_at (from "Normalize Submission").
// Output item: body (the exact JSON string to send), headers, url.
// Needs: PORTAL_LEAD_TENANT_ID and PORTAL_LEAD_SECRET in the n8n environment, and the crypto
// builtin allowed for Code nodes. The secret is never written into the workflow.
const crypto = require('crypto');
const item = $input.item.json;
const tenantId = $env.PORTAL_LEAD_TENANT_ID;
const secret = $env.PORTAL_LEAD_SECRET;
if (!tenantId || !secret) throw new Error('portal lead tenant id or secret is not set');

const parts = String(item.name || '').trim().split(/\s+/).filter(Boolean);
const lead = {
  externalId: crypto
    .createHash('sha256')
    .update(`${item.received_at}|${item.email}`)
    .digest('hex')
    .slice(0, 32),
  source: 'website_form',
  firstName: parts[0],
  email: String(item.email).trim().toLowerCase(),
  message: String(item.message).slice(0, 4000)
};
if (parts.length > 1) lead.lastName = parts.slice(1).join(' ');

const body = JSON.stringify(lead);
const timestamp = String(Math.floor(Date.now() / 1000));
const signature =
  'sha256=' + crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
return {
  json: {
    url: `https://portal.kyneticai.com/api/hooks/leads/${tenantId}`,
    body,
    headers: {
      'content-type': 'application/json',
      'x-kynetic-timestamp': timestamp,
      'x-kynetic-signature': signature
    }
  }
};
