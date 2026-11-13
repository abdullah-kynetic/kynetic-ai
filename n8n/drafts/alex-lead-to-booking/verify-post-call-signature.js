// Run Once for All Items. Front Door check for the ElevenLabs post-call webhook. Same scheme as the
// portal's own check (crm/src/server/adapters/voice/elevenlabs.ts): header "elevenlabs-signature" is
// "t=<unix seconds>,v0=<hex HMAC-SHA256 of '<t>.<raw body>'>", five minute window, constant-time compare.
// Needs NODE_FUNCTION_ALLOW_BUILTIN=crypto on the n8n instance and the Webhook node's Raw Body option on.
const crypto = require('crypto');
const item = $input.first();
const secret = $env.ELEVENLABS_POST_CALL_SECRET;
const header = String((item.json.headers || {})['elevenlabs-signature'] || '');
const raw = item.binary && item.binary.data ? Buffer.from(item.binary.data.data, 'base64').toString('utf8') : '';
const reject = () => [{ json: { verified: false } }];
if (!secret || !header || !raw) return reject();
const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=')));
const t = Number(parts.t);
if (!parts.v0 || !Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) return reject();
const expected = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest();
const given = Buffer.from(parts.v0, 'hex');
if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return reject();
return [{ json: { verified: true, body: JSON.parse(raw) } }];
