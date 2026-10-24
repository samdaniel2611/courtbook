const EXCHANGE = 'courtbook.events';
const QUEUE = 'notifications.booking-confirmed';
const DLX = 'courtbook.events.dlx';
const DLQ = 'notifications.booking-confirmed.dlq';

async function setupConsumer(channel, handleMessage, log = console.log) {
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  await channel.assertExchange(DLX, 'topic', { durable: true });
  await channel.assertQueue(DLQ, { durable: true });
  await channel.bindQueue(DLQ, DLX, '#');
  await channel.assertQueue(QUEUE, { durable: true, arguments: { 'x-dead-letter-exchange': DLX } });
  await channel.bindQueue(QUEUE, EXCHANGE, 'booking.confirmed');
  await channel.prefetch(1);
  return channel.consume(QUEUE, async (message) => {
    if (!message) return;
    let payload;
    try {
      payload = JSON.parse(message.content.toString());
      if (!payload || ['bookingId', 'userId', 'courtName', 'startsAt'].some((key) => payload[key] === undefined || payload[key] === null || payload[key] === '')) {
        throw new Error('Invalid booking confirmation payload');
      }
    } catch (_error) {
      channel.nack(message, false, false);
      return;
    }
    try {
      await handleMessage(payload, { log, messageId: message.properties?.messageId });
      channel.ack(message);
    } catch (_error) {
      channel.nack(message, false, false);
    }
  });
}

module.exports = { setupConsumer };
