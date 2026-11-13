-- P3-S4: a queued review request moves to sent or cancelled when the send runs. The table was
-- append-only; only these two columns become updatable, still limited to the tenant by row-level
-- security. Nothing else on the row can change.
GRANT UPDATE (status, completed_at) ON review_requests TO kynetic_app, kynetic_worker;
