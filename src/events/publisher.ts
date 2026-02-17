import amqp, { Channel } from "amqplib";

const EXCHANGE = "cargocloud.orders";

export type OrderEventType = "order.created";

export interface OrderEvent {
  type: OrderEventType;
  orderId: string;
  occurredAt: string;
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
 */
export async function publishOrderEvent(event: OrderEvent): Promise<void> {
  const ch = await getChannel();
  ch.publish(EXCHANGE, event.type, Buffer.from(JSON.stringify(event)), {
    contentType: "application/json",
    persistent: true,
    timestamp: Date.now(),
  });
}

export function buildEvent(
  type: OrderEventType,
  orderId: string,
  payload: Record<string, unknown>
): OrderEvent {
  return { type, orderId, occurredAt: new Date().toISOString(), payload };
}
