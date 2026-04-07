# orders-api

Order management API — the **system of record** for CargoCloud orders. Built with
[Fastify](https://fastify.dev) on Node.js 20 and PostgreSQL.

## Role at CargoCloud

Every parcel CargoCloud moves starts life here. `orders-api` owns the `orders` and
`order_items` tables, exposes the order lifecycle over REST, and publishes domain
events (`order.created`, `order.shipped`) to the `cargocloud.orders` topic exchange.

### Event consumers

| Repo | Why it listens |
| ---- | -------------- |
| [inventory-service](https://github.com/shipit-ai-demo-org/inventory-service) | Reserves warehouse stock on `order.created` |
| [payments-service](https://github.com/shipit-ai-demo-org/payments-service) | Captures payment once an order is confirmed |
| [notifications-service](https://github.com/shipit-ai-demo-org/notifications-service) | Sends customer emails on `order.created` / `order.shipped` |

Deployment manifests live in
[platform-helm-charts](https://github.com/shipit-ai-demo-org/platform-helm-charts).

## API surface

```
GET    /healthz                 liveness
GET    /readyz                  readiness
GET    /v1/orders               list orders (filter by status)
GET    /v1/orders/:id           fetch order + line items
POST   /v1/orders               create order (publishes order.created)
POST   /v1/orders/:id/ship      mark shipped (publishes order.shipped)
```

All non-health routes require the `x-cargocloud-api-key` header.

## Local development

```bash
npm install
cp .env.example .env   # set DATABASE_URL, AMQP_URL, ORDERS_API_KEY
npm run dev
```

Schema reference: [`src/db/schema.sql`](src/db/schema.sql).

## Configuration

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `3000` | HTTP listen port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `AMQP_URL` | `amqp://localhost` | Message broker URL |
| `ORDERS_API_KEY` | — | Static service-to-service key |
