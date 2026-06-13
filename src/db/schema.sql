-- CargoCloud orders schema
-- Applied via migrations pipeline; this file is the canonical reference.

CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'picking', 'shipped', 'delivered', 'cancelled')),
    currency        CHAR(3)     NOT NULL DEFAULT 'USD',
    total_cents     BIGINT      NOT NULL DEFAULT 0,
    shipping_method TEXT        NOT NULL DEFAULT 'ground',
    destination     JSONB       NOT NULL,
    idempotency_key TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One order per (customer, idempotency key); NULL keys are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency
    ON orders (customer_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID   NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    sku         TEXT   NOT NULL,
    quantity    INT    NOT NULL CHECK (quantity > 0),
    unit_cents  BIGINT NOT NULL CHECK (unit_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders (status);
CREATE INDEX IF NOT EXISTS idx_items_order     ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_items_sku       ON order_items (sku);
