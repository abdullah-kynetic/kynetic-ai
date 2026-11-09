# Invoice procedure — Stripe draft workflow

Tool choice: Stripe invoices, following the existing Plan 1 D-017 decision. This
procedure is documentation only: no Stripe account, price, invoice, charge, email
or webhook is created by it. New agency pricing/billing automation remains step 12
and requires a separate pricing decision before implementation.

## Reconcile the signed proposal

Use the executed proposal and agreement, currency, client billing details and
milestone acceptance evidence. Historical reference amounts are shown below;
these are not an instruction to configure live Stripe prices or classify a client
from test data. Do not reuse older setup-plus-monthly prices or assume a subscription.

| D-017 reference total (USD) | Start 50% | Built and sent for testing 25% | Completion 25% |
| --- | ---: | ---: | ---: |
| 4,675.00 | 2,337.50 | 1,168.75 | 1,168.75 |
| 8,500.00 | 4,250.00 | 2,125.00 | 2,125.00 |

The installments must sum to the exact signed total in integer cents. Add tax,
usage charges, discounts or due dates only when explicitly agreed. An unspecified
term remains a review item, not a default chosen by an automation.

## Draft, review, release

1. In test mode or an offline draft, use a clearly synthetic customer with no real
   billing recipient, payment method or automatic collection. Record a stable
   client/proposal/milestone reference to avoid duplicate invoices on retries.
2. Describe the agreed scope and milestone in the line item. Compare amount,
   currency, tax treatment, customer and milestone evidence with the agreement.
3. Abdullah reviews the exact draft. Stop before any live Stripe operation,
   finalization, sending, collection or real payment test; get explicit approval.
4. After an approved operation, record only the resulting invoice/status reference
   in the authorized workspace. Twenty writes beyond the four already approved
   step-3 test operations need a fresh dry run and explicit yes. Never DELETE.
5. Treat duplicate/out-of-order webhook deliveries idempotently. A failed webhook
   is not permission to charge again. Dunning, payment retries and notifications
   stay disabled until their separate test and approvals are complete.

No live payment evidence exists for this cloud documentation step. A stub preview
or a successful HTTP request is not proof that a client paid an invoice.
