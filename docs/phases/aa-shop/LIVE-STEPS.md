# Live steps for the AA shop track (nothing here runs until Abdullah says yes)

Filled in by the loop as steps finish. Each item states the exact change and target.

1. Deploy the merged `main` commit. Take the pre-deploy dump first. This applies the one migration that adds the `shop_ops` row to `module_catalog`. (After A-S1.)
2. Switch the module on for `aa-auto-body-shop`: set_client_module `shop_ops` = on.
3. Apply the Auto body industry template and ensure the auto body custom fields exist for `aa-auto-body-shop` (pipeline stages, services, fields).
4. Load sample data into `aa-auto-body-shop`: batch `aa-shop-demo-v1`, dry run first, then apply. Remove command: see A-S6.
5. Check `/api/health`, load each shop page signed in as the client, and keep outbound flags unchanged (stub, off).
