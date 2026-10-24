const amqp = require('amqplib');

const EXCHANGE = 'courtbook.events';
let connection;
let channel;
let connecting;

function reset(current) {
  if (!current || connection === current) {
    connection = undefined;
    channel = undefined;
    connecting = undefined;
  }
}

async function getChannel() {
  if (channel) return channel;
  if (connecting) return connecting;
  connecting = (async () => {
    const created = await amqp.connect(process.env.RABBITMQ_URL);
    connection = created;
    created.on('error', () => reset(created));
    created.on('close', () => reset(created));
    const createdChannel = await created.createChannel();
    await createdChannel.assertExchange(EXCHANGE, 'topic', { durable: true });
    if (connection === created) channel = createdChannel;
    return createdChannel;
  })();
  try {
    return await connecting;
  } catch (error) {
    reset(connection);
    throw error;
  }
}

async function publishBookingConfirmed(booking) {
  if (!process.env.RABBITMQ_URL) return;
  const payload = {
    bookingId: String(booking._id || booking.id),
    userId: booking.userId,
    courtId: booking.courtId,
    courtName: booking.courtName,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    depositAmount: booking.depositAmount,
    paidAt: booking.paidAt,
  };
  const activeChannel = await getChannel();
  activeChannel.publish(EXCHANGE, 'booking.confirmed', Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: 'application/json',
    messageId: `booking.confirmed:${payload.bookingId}`,
  });
}

module.exports = { publishBookingConfirmed };
