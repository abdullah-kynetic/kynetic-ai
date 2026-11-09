# DEV Alex template

`alex.json` creates a NEW `DEV-Alex Step2 Synthetic` on Blitz only. It has no live agent
ID, no shared calendar tools, authenticated web sessions, and only end-call/voicemail
built-ins. It collects project type, timeline and budget; email is optional. It makes
no real bookings or confirmation promises. Synthetic booking/tool behavior belongs to
the step-3 test chain before any real calendar write is considered.

`python3 tools/codex_step2.py` shows the provisioning plan without API calls.
`--apply` is retired with the DEV environment (2026-11-09 PST). It does not run. Do not check out `dev/codex-setup` to provision. The withdrawn mode used
only environment credentials, recorded newly created resource IDs immediately, and
resumed without buying duplicate phone numbers or creating duplicate agents/workflows.
The step-2 resources already exist; do not manually import the template again.

The DEV Twilio number is newly provisioned, separate from the existing caller number.
Only that new number is imported and assigned to the new DEV agent. SMS import is off,
and inbound voice/SMS hooks are cleared on the new number. No calls or messages are
placed. The new number remains provisioned on the account and has Twilio's normal
number charges; no price is hardcoded here. Resource IDs are in
`docs/codex/dev-resources.json`; credentials and actual phone numbers are not stored.

Live Alex is read-only. A canonical hash of its name, conversation/platform config,
workflow, number assignments and branch/version is compared before and after provisioning.
Do not publish, patch or delete it. Do not release any existing phone number.
