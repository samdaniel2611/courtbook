jest.mock('amqplib', () => ({ connect: jest.fn() }));

const { setupConsumer } = require('../src/consumer');
const { handleMessage } = require('../src/handler');

function setup(handler = handleMessage) {
  const channel = {
    assertExchange: jest.fn().mockResolvedValue(undefined),
    assertQueue: jest.fn().mockResolvedValue(undefined),
    bindQueue: jest.fn().mockResolvedValue(undefined),
    prefetch: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn(async (_queue, callback) => { channel.callback = callback; }),
    ack: jest.fn(), nack: jest.fn(),
  };
  const log = jest.fn();
  return setupConsumer(channel, handler, log).then(() => ({ channel, log }));
}

const message = (content, messageId = 'booking.confirmed:abc') => ({ content: Buffer.from(content), properties: { messageId } });
const valid = JSON.stringify({ bookingId: 'abc', userId: 'user-1', courtName: 'Center Court', startsAt: '2030-01-02T10:00:00Z' });

test('valid message is handled then acked', async () => {
  const handler = jest.fn();
  const { channel } = await setup(handler);
  const msg = message(valid);
  await channel.callback(msg);
  expect(handler).toHaveBeenCalledTimes(1);
  expect(channel.ack).toHaveBeenCalledWith(msg);
});

test('duplicate messageId is acked but handled once', async () => {
  const log = jest.fn();
  const { channel } = await setup((payload, options) => handleMessage(payload, options));
  const first = message(valid, 'unique-notification-test');
  const second = message(valid, 'unique-notification-test');
  await channel.callback(first);
  await channel.callback(second);
  expect(channel.ack).toHaveBeenCalledTimes(2);
  expect(log).not.toHaveBeenCalled();
});

test('invalid JSON is nacked without requeue', async () => {
  const { channel } = await setup();
  const msg = message('{');
  await channel.callback(msg);
  expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
});

test('missing required fields is nacked without requeue', async () => {
  const { channel } = await setup();
  const msg = message(JSON.stringify({ bookingId: 'abc', userId: 'user-1', courtName: 'Court' }));
  await channel.callback(msg);
  expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
});

test('handler failure is nacked without requeue', async () => {
  const { channel } = await setup(() => { throw new Error('failed'); });
  const msg = message(valid);
  await channel.callback(msg);
  expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
  expect(channel.ack).not.toHaveBeenCalled();
});
