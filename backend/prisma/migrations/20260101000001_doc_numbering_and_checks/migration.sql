-- Non-negative balance guarantees (defense in depth alongside application-level checks)
ALTER TABLE "inventory_balances" ADD CONSTRAINT "chk_quantity_nonneg" CHECK ("quantity" >= 0);
ALTER TABLE "inventory_balances" ADD CONSTRAINT "chk_reserved_nonneg" CHECK ("reserved_quantity" >= 0);
ALTER TABLE "inventory_balances" ADD CONSTRAINT "chk_available_nonneg" CHECK ("available_quantity" >= 0);

-- Concurrency-safe document numbering: one sequence per document type.
-- nextval() is atomic under Postgres MVCC, no application-level locking needed,
-- and never collides even under concurrent requests (spec requirement: no "max + 1" in app code).
CREATE SEQUENCE IF NOT EXISTS "seq_transaction_no";
CREATE SEQUENCE IF NOT EXISTS "seq_receiving_no";
CREATE SEQUENCE IF NOT EXISTS "seq_issuance_no";
CREATE SEQUENCE IF NOT EXISTS "seq_transfer_no";
CREATE SEQUENCE IF NOT EXISTS "seq_return_no";
CREATE SEQUENCE IF NOT EXISTS "seq_adjustment_no";
CREATE SEQUENCE IF NOT EXISTS "seq_count_no";

-- Formats <PREFIX>-<YEAR>-<6-digit-sequence>, e.g. RCV-2026-000001.
-- Called as `SELECT generate_doc_no('RCV', 'seq_receiving_no')` inside the same
-- DB transaction that inserts the parent row, so the number and the row commit or roll back together.
CREATE OR REPLACE FUNCTION generate_doc_no(p_prefix text, p_seq_name text)
RETURNS text AS $$
DECLARE
  v_next bigint;
BEGIN
  EXECUTE format('SELECT nextval(%L)', p_seq_name) INTO v_next;
  RETURN p_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_next::text, 6, '0');
END;
$$ LANGUAGE plpgsql;
