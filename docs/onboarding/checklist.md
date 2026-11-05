# Client onboarding checklist

Use one authorized client workspace and record reviewer/date/evidence for every
completed item. A checked cloud test is not a checked live launch. This list does
not create client records, send documents, contact a person or enable a workflow.

## Qualification and commercial review

- [ ] Confirm business legal name/state; reject FL/OK businesses.
- [ ] Confirm Plan 1 scope, service area, project types and lead sources.
- [ ] Reconcile approved quote, [proposal](proposal.md), [agreement](contract.md)
      and [invoice milestones](invoice.md); resolve unagreed terms before signature.
- [ ] Identify the authorized signer, operations owner and exception contact.
- [ ] Confirm lead consent provenance, approved wording and recording disclosure.

## Workspace and technical inputs

- [ ] Verify the tenant and least-privilege users; require real server-side sessions.
- [ ] Collect hours, IANA time zone, holidays, buffers, appointment duration,
      calendar/event ownership and booking rules. Empty business hours mean closed.
- [ ] Capture project type/budget requirements; lead email remains optional.
- [ ] Obtain credentials through the approved secret channel; store names/references
      only in docs. Set source-specific webhook signing secret and replay policy.
- [ ] Verify dedicated DEV resources and isolated database before synthetic tests.
      Do not select live Alex or Kynetic Restoration (Demo) records.

## Synthetic acceptance

- [ ] Signed intake accepts a valid synthetic lead once; duplicate events do not
      create duplicate processing. Invalid/stale/missing signatures are rejected.
- [ ] FL/OK lead rejection, missing/revoked consent, quiet hours and global/tenant
      kill switches prevent sends. Internal opt-outs stay enforced; registry deferred.
- [ ] Booking uses an explicitly open slot; closed/cross-closing slots fail;
      concurrent/replayed booking produces one simulated appointment.
- [ ] Delayed retries preserve identifiers and respect expiry. Uncertain sends
      require review, not blind retries. No actual call/SMS in cloud acceptance.
- [ ] Review all notification previews: missed call, confirmation/reminder,
      owner alert and redacted error alert. Confirm test-only recipient handling.
- [ ] Record existing synthetic Twenty evidence; no further write without a new
      exact dry run and yes. No deletion or changes to protected demo records.

## Release and handover

- [ ] Push accepted code; run the ONE final DEV deployment from the Mac.
- [ ] Record deployed revision, DEV HTTP/auth and rollback-only gate evidence.
- [ ] Complete [walkthrough](walkthrough.md) preparation and email DNS inventory.
- [ ] STOP for Abdullah's explicit step-6 live-test approval. TEST_PHONE only through
      the pinned DEV agent/dedicated DEV number; never activate n8n implicitly.
- [ ] Keep production deployment, DNS, live Stripe and workflow activation separate
      approval gates. Agency steps 7+ also require a separate yes after step 6.
