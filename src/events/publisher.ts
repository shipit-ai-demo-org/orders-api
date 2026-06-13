import amqp, { Channel } from "amqplib";

const EXCHANGE = "cargocloud.orders";

export type OrderEventType = "order.created" | "order.shipped";

export interface OrderEvent {
  type: OrderEventType;
  orderId: string;
  occurredAt: string;
  /** Correlation id of the originating HTTP request, if any. */
  requestId?: string;
  payload: Record<string, unknown>;
}

let channel: Channel | undefined;

async function getChannel(): Promise<Channel> {
  if (!channel) {
    const conn = await amqp.connect(process.env.AMQP_URL ?? "amqp://localhost");
    channel = await conn.createChannel();
    await channel.assertExchange(EXCHANGE, "topic", { durable: true });
  }
  return channel;
}

/**
 * Publishes domain events consumed by inventory-service, payments-service
 * and notifications-service. Routing key mirrors the event type so consumers
 * can bind with topic patterns like "order.*".
 *
 * When the event carries a request id it is also exposed as an
 * `x-request-id` AMQP header, so downstream consumers can correlate their
 * logs with the originating HTTP request without parsing the payload.
 */
export async function publishOrderEvent(event: OrderEvent): Promise<void> {
  const ch = await getChannel();
  const headers: Record<string, unknown> = {};
  if (event.requestId) {
    headers["x-request-id"] = event.requestId;
  }
  ch.publish(EXCHANGE, event.type, Buffer.from(JSON.stringify(event)), {
    contentType: "application/json",
    persistent: true,
    timestamp: Date.now(),
    headers,
  });
}

export function buildEvent(
  type: OrderEventType,
  orderId: string,
  payload: Record<string, unknown>,
  requestId?: string
): OrderEvent {
  return {
    type,
    orderId,
    occurredAt: new Date().toISOString(),
    requestId,
    payload,
  };
}
