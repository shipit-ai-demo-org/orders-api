import { FastifyInstance } from "fastify";
import { getPool, withTransaction } from "../db/client";
import { buildEvent, publishOrderEvent } from "../events/publisher";

interface OrderItemInput {
  sku: string;
  quantity: number;
  unitCents: number;
}

interface CreateOrderBody {
  customerId: string;
  currency?: string;
  shippingMethod?: string;
  destination: Record<string, unknown>;
  items: OrderItemInput[];
}

export default async function orderRoutes(app: FastifyInstance) {
  app.get("/orders", async (req) => {
    const { status, limit = 50 } = req.query as { status?: string; limit?: number };
    const pool = getPool();
    const params: unknown[] = [Math.min(Number(limit), 200)];
    let sql = "SELECT * FROM orders";
    if (status) {
      params.push(status);
      sql += " WHERE status = $2";
    }
    sql += " ORDER BY created_at DESC LIMIT $1";
    const { rows } = await pool.query(sql, params);
    return { orders: rows };
  });

  app.get("/orders/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const pool = getPool();
    const { rows } = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    if (rows.length === 0) {
      reply.code(404);
      return { error: "order_not_found" };
    }
    const items = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [id]);
    return { order: rows[0], items: items.rows };
  });

  app.post("/orders", async (req, reply) => {
    const body = req.body as CreateOrderBody;

    if (!Array.isArray(body.items) || body.items.length === 0) {
      reply.code(400);
      return { error: "order_requires_items" };
    }
    const invalid = body.items.find(
      (it) => !Number.isInteger(it.quantity) || it.quantity <= 0 || it.unitCents < 0
    );
    if (invalid) {
      reply.code(400);
      return { error: "invalid_line_item", sku: invalid.sku };
    }

    const order = await withTransaction(async (tx) => {
      const totalCents = body.items.reduce(
        (sum, it) => sum + it.quantity * it.unitCents,
        0
      );
      const { rows } = await tx.query(
        `INSERT INTO orders (customer_id, currency, shipping_method, destination, total_cents)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          body.customerId,
          body.currency ?? "USD",
          body.shippingMethod ?? "ground",
          JSON.stringify(body.destination),
          totalCents,
        ]
      );
      const created = rows[0];
      for (const item of body.items) {
        await tx.query(
          `INSERT INTO order_items (order_id, sku, quantity, unit_cents)
           VALUES ($1, $2, $3, $4)`,
          [created.id, item.sku, item.quantity, item.unitCents]
        );
      }
      return created;
    });

    await publishOrderEvent(
      buildEvent(
        "order.created",
        order.id,
        {
          customerId: order.customer_id,
          totalCents: order.total_cents,
          itemCount: body.items.length,
        },
        req.id
      )
    );

    reply.code(201);
    return { order };
  });

  app.post("/orders/:id/ship", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { trackingNumber, carrier } = req.body as {
      trackingNumber: string;
      carrier: string;
    };

    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE orders SET status = 'shipped', updated_at = now()
       WHERE id = $1 AND status IN ('confirmed', 'picking')
       RETURNING *`,
      [id]
    );
    if (rows.length === 0) {
      reply.code(409);
      return { error: "invalid_status_transition" };
    }

    await publishOrderEvent(
      buildEvent("order.shipped", id, { trackingNumber, carrier }, req.id)
    );

    return { order: rows[0] };
  });
}
