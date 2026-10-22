# effects: if you are changing X, open these cards

An index, not a copy. If it disagrees with a card, fix the card.

| You are changing | Open |
|---|---|
| Alex's words, voice, tools, Cal event | [[alex-prompt]], [[alex-agent]], [[retell-agent-tools]], process [[change-alex]] |
| The form fields or consent text | [[alex-form-spec]], [[outbound-speed-to-lead-workflow]], KI-002 / task 1.4 |
| The speed-to-lead workflow (either n8n) | [[outbound-speed-to-lead-workflow]], process [[lead-to-call]], [[twenty-lead-objects]] |
| A Twenty field used by n8n | [[twenty-lead-objects]], [[outbound-speed-to-lead-workflow]] |
| Which Retell agent the code writes to | [[retell-client]], [[retell-allowlist]] |
| The n8n instance or the backup | [[n8n-backup-copy]], process [[backup-n8n]] |
| Price or invoice split | [[pricing-d017]], [[context-docs-mirror]] |
| Building out the portal (Twenty sync, onboarding, proposals) | `../PORTAL-BUILDOUT.md` first, then the portal cards below |
| Anything under `portal/` | [[portal-tenancy-rls]], [[portal-auth]], [[portal-files-storage]], [[portal-ingest-api]]; shipping: [[portal-deploy]], process [[deploy-portal]] |
| Nora, Emily, the Restoration demo | no cards: read-only, see `../CONTEXT.md` no-touch list |
| The bake-off or the 11Labs workflow | [[bakeoff-summary]] |
| Lead lists or Twenty Companies loaded from them | [[lead-engine]] |
| Docs at session end | process [[end-of-session-docs]], [[context-docs-mirror]] |
| Skills, MCP, env names | [[repo-skills]], [[mcp-config]] |

## What points in from outside the tree
Retell agent webhook URL (-> the n8n workflow path), the deploy trigger (-> `portal-deploy.sh`), the Meta/ad form link, Cal.com, Stripe, and whatever should post to `/api/ingest/results` (nothing found).
