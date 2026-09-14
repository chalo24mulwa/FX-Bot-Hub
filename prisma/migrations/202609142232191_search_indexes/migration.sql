-- Full-text search support for products.searchVector (declared as
-- Unsupported("tsvector") in schema.prisma since Prisma can't manage
-- tsvector generation itself).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Keep searchVector in sync on insert/update. Name is weighted highest,
-- then summary/description, then tags.
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."shortSummary", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."description", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW."tags", ' '), '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_search_vector_trigger ON "products";
CREATE TRIGGER products_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "name", "shortSummary", "description", "tags"
  ON "products"
  FOR EACH ROW
  EXECUTE FUNCTION products_search_vector_update();

-- Backfill any existing rows.
UPDATE "products" SET "name" = "name";

-- GIN index for full-text search.
CREATE INDEX IF NOT EXISTS "products_search_vector_idx" ON "products" USING GIN ("searchVector");

-- Trigram index to support fuzzy/ILIKE-style search on product name.
CREATE INDEX IF NOT EXISTS "products_name_trgm_idx" ON "products" USING GIN ("name" gin_trgm_ops);
