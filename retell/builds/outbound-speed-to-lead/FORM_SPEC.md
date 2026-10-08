# Lead form spec (Meta Instant Form and the n8n form that stands in for it)

DRAFT. The consent wording is a placeholder until counsel approves it (task 1.4, docs/counsel-questions.md Q1). Do not run real ads or real leads through this until that wording is signed off.

## Purpose
One form captures everything the outbound agent needs. For now it is an n8n Form Trigger (D-014). Later the same fields map one to one onto the client's Meta Instant Form, and only the trigger node changes.

## Fields

| # | Label | Type | Required | Maps to (Twenty endCustomer) | Retell dynamic variable |
|---|---|---|---|---|---|
| 1 | Full name | text | yes | fullName, name | first_name (first word) |
| 2 | Phone number | phone | yes | phones | to_number (E.164) |
| 3 | ZIP code | text | yes | location | zip |
| 4 | Do you own the property? | dropdown: Yes, No | yes | ownsProperty | owns_property |
| 5 | What's going on with your roof? | dropdown: Leak, Storm or hail damage, Need a replacement quote, Just looking | yes | issueType | issue_type |
| 6 | How soon do you want it looked at? | dropdown: As soon as possible, Within 2 weeks, Within 3 months, Just exploring | yes | timeline | timeline |
| 7 | Consent checkbox | checkbox | yes | consentText, consentAt | none |

Email is deliberately not asked on the form. The agent collects it on the call when booking (spelled back), which also confirms it is correct.

## Consent wording (DRAFT, pending counsel)
> By submitting this form, I agree that [Company] and its AI assistant may call me at the number I entered about my request, using an artificial or AI generated voice. Calls may be recorded. I understand consent is not a condition of any purchase.

Stored with the lead: the exact wording shown, the timestamp, the form version, and the lead source (D-011).

## Meta Instant Form notes (for the client's ad account)
- Form type: higher intent (adds a review step) to cut junk leads.
- Pre-fill name and phone from the profile, keep the questions above as custom questions.
- Add the consent checkbox as a custom disclaimer with the wording above. Meta supports a custom disclaimer and checkbox on lead forms.
- Privacy policy link required; use the client's.
- Thank you screen: "Thanks, we'll call you in about a minute. Our AI assistant will introduce itself."
- We cannot create this in Meta from here (needs the client's Ads Manager access). Task: when a client signs, set up the form from this spec and point the Meta webhook or Zapier style trigger at the n8n workflow.

## n8n form specifics
- Form title: "Get a free roof inspection | Summit Ridge Roofing" (demo). Response text: "Thanks. Our AI assistant will call you in about a minute."
- Test mode: use your own phone number only. Never enter a number you do not own.
- The workflow validates the phone (E.164, US), checks the 24 hour duplicate rule for new submissions, and requires the consent checkbox before placing any call. Anything failing the gate is written to Twenty with a status and not dialed (D-014).
