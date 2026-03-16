-- FocusBuddy migration 005: ensure bills.amount is numeric(10,2)
-- If the column was created as integer, amounts are truncated to whole numbers
-- before they ever reach the JS layer — no JS fix can recover the cents.
-- USING clause converts existing integer values safely; numeric values are cast as-is.
ALTER TABLE bills ALTER COLUMN amount TYPE numeric(10,2) USING amount::numeric(10,2);
