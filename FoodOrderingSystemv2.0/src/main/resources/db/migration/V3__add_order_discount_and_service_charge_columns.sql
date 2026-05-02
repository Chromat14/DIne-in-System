ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS service_charge_amount NUMERIC(12,2);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2);

UPDATE orders
SET service_charge_amount = 0
WHERE service_charge_amount IS NULL;

UPDATE orders
SET discount_amount = 0
WHERE discount_amount IS NULL;

ALTER TABLE orders
    ALTER COLUMN service_charge_amount SET DEFAULT 0,
    ALTER COLUMN service_charge_amount SET NOT NULL;

ALTER TABLE orders
    ALTER COLUMN discount_amount SET DEFAULT 0,
    ALTER COLUMN discount_amount SET NOT NULL;
