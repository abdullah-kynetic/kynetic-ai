-- M10-01: keep phone-fragment GIN searches tenant-leading like the other contacts indexes.
DROP INDEX IF EXISTS contacts_phone_fragment_trgm;
CREATE INDEX contacts_phone_fragment_trgm
  ON contacts USING gin (
    tenant_id,
    (regexp_replace(contacts_phones_search(phones), '[^0-9]', '', 'g')) gin_trgm_ops
  )
  WHERE deleted_at IS NULL;
