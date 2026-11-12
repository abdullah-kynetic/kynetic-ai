# TCPA Consent & Opt-Out Language

_Twenty note `5f9b84d7`, created 2026-09-24, updated 2026-10-14. Exported 2026-11-12._

**STATUS (Oct 13, 2026):** the Sep 7 'RESOLVED' below came from an informal lawyer contact. Formal counsel sign-off is still pending (task 1.4, attorney review 4.8). AI voice is an artificial voice under TCPA (FCC, Feb 2024), so counsel-approved AI-call consent wording is required on every client lead form.

---

Draft, not reviewed by an attorney at time of writing. TCPA carries statutory damages ($500-$1,500 per violating message).

**1. Consent capture (intake/lead form):** "By providing your phone number, you consent to receive text messages and calls from [Business Name] about your service request, including appointment confirmations and follow-ups. Message and data rates may apply. Message frequency varies. Reply STOP to opt out at any time, HELP for help. Consent is not a condition of purchase."

**2. First outbound SMS:** must self-identify and include opt-out instructions: "This is [Business Name] (AI-assisted). [message content]. Reply STOP to unsubscribe."

**3. Every subsequent SMS:** fixed footer appended by the workflow, not the AI agent: "Reply STOP to unsubscribe, HELP for help."

**4. Opt-out handling (hard requirement):** STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT immediately suppresses all future SMS to that number. Suppression flag lives on the Contact record (SMS Opt-Out field), checked before every outbound send. One confirmation of opt-out, then no further messages except direct replies. Opt-out applies per business/client, not globally.

**5. Emergency-branch caveat, RESOLVED Sep 7, 2026:** Attorney review (via a lawyer contact, not yet formal retained counsel) confirmed a burst pipe/storm damage does not qualify for TCPA's emergency exemption, and an inbound call alone does not create consent to text. Fix: one verbal consent turn added to the Retell agent's emergency-case prompt before the SMS webhook fires ("Can I text your arrival updates to this number?"). If caller agrees, SMS fires as normal (fresh consent overrides prior opt-out for this exchange). If caller declines, SMS is suppressed and details are read aloud instead.

**6. Time-of-day restriction:** no marketing/follow-up SMS outside 8am-9pm in the recipient's local time zone.

**7. Record-keeping:** timestamped log of consent capture and opt-out events kept on the Contact/Calls record. Burden of proof for consent sits with the business.

**Still to do (as of last update):** add the consent-turn line to the actual Retell Emergency case prompt, add branching logic so the SMS webhook only fires on affirmative response, confirm whether the lawyer's read counts as sufficient sign-off or whether formal retained counsel is needed before client #1 goes live, update the Delivery Guide QA checklist to test both consent branches.
