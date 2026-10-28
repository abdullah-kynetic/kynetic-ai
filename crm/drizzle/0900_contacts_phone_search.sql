-- F-37: accelerate phone-fragment searches over contact phone arrays. PostgreSQL marks its
-- array_to_string(text[]) overload STABLE because arbitrary output functions may depend on GUCs;
-- for this fixed text[] input and fixed separator the operation is immutable, so pin that behavior.
CREATE FUNCTION contacts_phones_search(text[])
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = pg_catalog
AS $$ SELECT array_to_string($1, ' ') $$;
--> statement-breakpoint
CREATE INDEX contacts_phone_fragment_trgm
  ON contacts USING gin ((regexp_replace(contacts_phones_search(phones), '[^0-9]', '', 'g')) gin_trgm_ops)
  WHERE deleted_at IS NULL;
