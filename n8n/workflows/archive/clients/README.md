# Archived client n8n workflows

Retired client workflows, kept for reference only. **Never deploy or import these.** Archived Nov 9, 2026.

Each workflow has two files:
- **VPS export** (`<slug>__<VPS id>.json`): exported from the self-hosted n8n (n8n.kyneticai.com) on Nov 9, 2026. pinData and staticData are removed, and these values are redacted: Notion database and data-source IDs, Telegram admin chat IDs, the Stripe payment link, business phone numbers, and the random suffix of the Stripe webhook path. Credentials are referenced by name only; n8n never exports credential values.
- **Old cloud copy** (`<slug>__<cloud id>.json`): the earlier n8n-cloud backup, moved here from `n8n/workflows/active/` unchanged.

On the VPS, the workflows stay inactive and are being moved into the n8n Archive folder. They are not deleted.

## Seekers Youth (`seekers-youth/`)
| Workflow | VPS id | Old cloud id | What it did |
|---|---|---|---|
| WF — Seekers Youth Staff Bot | B5BGVXmJvAdTsQAt | YEjOwG1Aq6ORIlIc | A Telegram AI agent (OpenRouter) for Seekers Youth staff: checks that the staff member is registered, logs attendance and expenses to Notion, answers from a Notion knowledge base, and alerts the admin about expenses and errors |
| WF — Seekers Approval Handler | S0bJvdSH5ajJQ7P0 | L4MqMMIa8aNAwdmA | Admin approval of pending expenses over Telegram: parses the approval, matches the expense code in Notion, updates it, and notifies the director |

## Porchlight Card (`porchlight-card/`)
| Workflow | VPS id | Old cloud id | What it did |
|---|---|---|---|
| Porchlight Card: Ad Intake Form | uI8UJHDz8vylKiIj | EAQ1whwjHb6ntgeM | An n8n form where an advertiser submits ad content and logo. An LLM tidies the copy, the business is matched or added in the Notion call list, and a confirmation goes out by Gmail |
| Porchlight Card: Payment Received | kkrEfqfqCeAo5rLS | r15zGLOW6LVWuEOB | A Stripe checkout webhook: marks the business paid in the Notion call list (or adds it) and emails a welcome plus the ad form link |
| Porchlight Card: Send Payment Link | Pcj8L9GowKlxWClr | AANCbsZrmEqiiTpa | An n8n form that emails a business the Stripe payment link and marks "link sent" in the Notion call list |

Credentials referenced (names only):
- Notion account / Notion account 2
- OpenRouter account / n8n openrouter
- seekers staff demo (Telegram)
- Abdullah Kynetic account (Gmail)

All of these would have to be recreated before any import.
