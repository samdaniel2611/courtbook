process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/booking_events_test_db';
process.env.JWT_SECRET = 'booking-events-test-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'booking-events-webhook-secret';

jest.mock('amqplib', () => ({ connect: jest.fn() }));

const crypto = require('crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const amqp = require('amqplib');
const { publishBookingConfirmed } = require('../src/events');
const app = require('../src/app');
const Booking = require('../src/models/Booking');

const paidPayload = (orderId = 'order_event') => ({ event: 'order.paid', payload: { order: { entity: { id: orderId } }, payment: { entity: { id: 'pay_event', amount: 5000 } } } });
const deliver = (payload, signatureOverride) => {
  const raw = Buffer.from(JSON.stringify(payload));
  const signature = signatureOverride || crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  return request(app).post('/webhooks/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', signature).send(raw.toString());
};

beforeAll(async () => { await mongoose.connect(process.env.MONGO_URI); await Booking.init(); });
const mockChannel = { assertExchange: jest.fn().mockResolvedValue(undefined), publish: jest.fn().mockReturnValue(true) };
beforeEach(() => {
  process.env.RABBITMQ_URL = 'amqp://test';
  mockChannel.assertExchange.mockClear();
  mockChannel.publish.mockClear().mockReturnValue(true);
  const mockConnection = { on: jest.fn(), createChannel: jest.fn().mockResolvedValue(mockChannel) };
  amqp.connect.mockReset().mockResolvedValue(mockConnection);
});
afterEach(async () => { await Booking.deleteMany({}); });
afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

test('publishes once after a pending booking is confirmed, with safe expected fields', async () => {
  const startsAt = new Date('2030-01-02T10:00:00Z');
  const booking = await Booking.create({ courtId: 'court-1', courtName: 'Center Court', userId: 'user-1', startsAt, endsAt: new Date(+startsAt + 3600000), razorpayOrderId: 'order_event' });
  const payload = paidPayload();
  await deliver(payload).expect(200);
  await deliver(payload).expect(200);
  expect(mockChannel.publish).toHaveBeenCalledTimes(1);
  const [exchange, routingKey, buffer, options] = mockChannel.publish.mock.calls[0];
  expect(exchange).toBe('courtbook.events');
  expect(routingKey).toBe('booking.confirmed');
  expect(JSON.parse(buffer.toString())).toMatchObject({ bookingId: booking.id, userId: 'user-1', courtId: 'court-1', courtName: 'Center Court', depositAmount: 5000 });
  expect(options).toMatchObject({ persistent: true, contentType: 'application/json', messageId: `booking.confirmed:${booking.id}` });
});

test('invalid signature does not publish', async () => {
  await Booking.create({ courtId: 'court-1', courtName: 'Center Court', userId: 'user-1', startsAt: new Date('2030-01-02T10:00:00Z'), endsAt: new Date('2030-01-02T11:00:00Z'), razorpayOrderId: 'order_event' });
  await deliver(paidPayload(), '0'.repeat(64)).expect(400);
  expect(mockChannel.publish).not.toHaveBeenCalled();
});

test('publish errors do not change the 200 response or confirmed booking', async () => {
  await Booking.create({ courtId: 'court-1', courtName: 'Center Court', userId: 'user-1', startsAt: new Date('2030-01-02T10:00:00Z'), endsAt: new Date('2030-01-02T11:00:00Z'), razorpayOrderId: 'order_event' });
  mockChannel.publish.mockImplementationOnce(() => { throw new Error('connection details must not be logged'); });
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  await deliver(paidPayload()).expect(200);
  expect((await Booking.findOne({ razorpayOrderId: 'order_event' })).status).toBe('confirmed');
  expect(error).toHaveBeenCalledWith('Booking confirmation event publish failed');
  error.mockRestore();
});

test('missing RabbitMQ URL skips publishing without failure', async () => {
  await Booking.create({ courtId: 'court-1', courtName: 'Center Court', userId: 'user-1', startsAt: new Date('2030-01-02T10:00:00Z'), endsAt: new Date('2030-01-02T11:00:00Z'), razorpayOrderId: 'order_event' });
  delete process.env.RABBITMQ_URL;
  await deliver(paidPayload()).expect(200);
  expect(mockChannel.publish).not.toHaveBeenCalled();
});
