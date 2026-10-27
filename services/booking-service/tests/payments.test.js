process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/booking_payments_test_db';
process.env.JWT_SECRET = 'booking-payments-test-secret';
process.env.RAZORPAY_KEY_ID = 'rzp_test_public';
process.env.RAZORPAY_KEY_SECRET = 'test-only-key-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'booking-webhook-test-secret';
process.env.PENDING_TTL_MINUTES = '15';
process.env.VENUE_SERVICE_URL = 'http://venue.test';

jest.mock('axios');
jest.mock('razorpay', () => jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })));

const axios = require('axios');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const Booking = require('../src/models/Booking');
let mockCreateOrder;

const tokenFor = (sub) => jwt.sign({ email: `${sub}@example.test` }, process.env.JWT_SECRET, { subject: sub });
const auth = (sub = 'owner') => `Bearer ${tokenFor(sub)}`;
const startAt = () => {
  const date = new Date();
  date.setTime(Date.now() + 2 * 60 * 60 * 1000);
  date.setUTCMinutes(30, 0, 0);
  return date;
};
const makeBooking = (fields = {}) => {
  const startsAt = fields.startsAt || startAt();
  return Booking.create({ courtId: 'court-1', courtName: 'Center Court', userId: 'owner', startsAt, endsAt: new Date(+startsAt + 3600000), ...fields });
};
const hook = async (payload, signaturePayload = payload) => {
  const raw = Buffer.from(JSON.stringify(signaturePayload));
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  return { raw, signature };
};
const paidEvent = (orderId, paymentId = 'pay_123', amount = 5000) => ({
  event: 'order.paid', payload: { order: { entity: { id: orderId } }, payment: { entity: { id: paymentId, amount } } },
});

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Booking.init();
});
beforeEach(() => {
  axios.get.mockResolvedValue({ data: { _id: 'court-1', name: 'Center Court' } });
  Razorpay.mockClear();
  mockCreateOrder = jest.fn().mockResolvedValue({ id: 'order_123' });
  Razorpay.mockImplementation(() => {
    return { orders: { create: mockCreateOrder } };
  });
});
afterEach(async () => { await Booking.deleteMany({}); jest.clearAllMocks(); });
afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

describe('POST /bookings/:id/pay', () => {
  test('requires a token', async () => { await request(app).post('/bookings/507f1f77bcf86cd799439011/pay').expect(401); });
  test('owner creates an order and stores its id without exposing the secret', async () => {
    const booking = await makeBooking();
    const response = await request(app).post(`/bookings/${booking.id}/pay`).set('Authorization', auth()).expect(200);
    expect(response.body).toEqual({ orderId: 'order_123', amount: 5000, currency: 'INR', keyId: 'rzp_test_public' });
    expect(JSON.stringify(response.body)).not.toContain(process.env.RAZORPAY_KEY_SECRET);
    expect((await Booking.findById(booking.id)).razorpayOrderId).toBe('order_123');
    expect(mockCreateOrder).toHaveBeenCalledWith({ amount: 5000, currency: 'INR', receipt: booking.id, notes: { bookingId: booking.id } });
    const repeated = await request(app).post(`/bookings/${booking.id}/pay`).set('Authorization', auth()).expect(200);
    expect(repeated.body.orderId).toBe('order_123');
    expect(mockCreateOrder).toHaveBeenCalledTimes(1);
  });
  test('validates id, hides another owner booking, and conflicts for cancelled bookings', async () => {
    await request(app).post('/bookings/nope/pay').set('Authorization', auth()).expect(400);
    const other = await makeBooking({ userId: 'other' });
    await request(app).post(`/bookings/${other.id}/pay`).set('Authorization', auth()).expect(404);
    const cancelled = await makeBooking({ status: 'cancelled' });
    await request(app).post(`/bookings/${cancelled.id}/pay`).set('Authorization', auth()).expect(409);
  });
  test('reuses an existing order', async () => {
    const booking = await makeBooking({ razorpayOrderId: 'order_existing' });
    const response = await request(app).post(`/bookings/${booking.id}/pay`).set('Authorization', auth()).expect(200);
    expect(response.body.orderId).toBe('order_existing');
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });
  test('sanitizes Razorpay failures', async () => {
    const booking = await makeBooking();
    mockCreateOrder.mockRejectedValue(new Error(process.env.RAZORPAY_KEY_SECRET));
    const response = await request(app).post(`/bookings/${booking.id}/pay`).set('Authorization', auth()).expect(502, { error: 'Payment service unavailable' });
    expect(JSON.stringify(response.body)).not.toContain(process.env.RAZORPAY_KEY_SECRET);
  });
});

describe('POST /webhooks/razorpay', () => {
  test('rejects missing and wrong signatures without changing a booking', async () => {
    const booking = await makeBooking({ razorpayOrderId: 'order_123' });
    const body = paidEvent('order_123');
    const { raw, signature } = await hook(body);
    await request(app).post('/webhooks/razorpay').set('Content-Type', 'application/json').send(raw.toString('utf8')).expect(400, { error: 'Invalid signature' });
    await request(app).post('/webhooks/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', '0'.repeat(64)).send(raw.toString('utf8')).expect(400, { error: 'Invalid signature' });
    expect((await Booking.findById(booking.id)).status).toBe('pending');
    expect(signature).toHaveLength(64);
  });
  test('confirms a valid payment and ignores duplicate delivery', async () => {
    const booking = await makeBooking({ razorpayOrderId: 'order_123' });
    const body = paidEvent('order_123');
    const { raw, signature } = await hook(body);
    await request(app).post('/webhooks/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', signature).send(raw.toString('utf8')).expect(200);
    const paid = await Booking.findById(booking.id);
    expect(paid.status).toBe('confirmed');
    expect(paid.razorpayPaymentId).toBe('pay_123');
    expect(paid.paidAt).toBeInstanceOf(Date);
    await request(app).post('/webhooks/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', signature).send(raw.toString('utf8')).expect(200);
    expect((await Booking.findById(booking.id)).razorpayPaymentId).toBe('pay_123');
  });
  test.each([
    ['unknown order', null, paidEvent('unknown_order')],
    ['amount mismatch', 'pending', paidEvent('order_123', 'pay_wrong', 1)],
    ['cancelled booking', 'cancelled', paidEvent('order_123')],
    ['other event', 'pending', { event: 'payment.captured', payload: {} }],
  ])('%s is acknowledged without confirmation', async (_label, status, body) => {
    const booking = status ? await makeBooking({ razorpayOrderId: 'order_123', status }) : await makeBooking();
    const { raw, signature } = await hook(body);
    await request(app).post('/webhooks/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', signature).send(raw.toString('utf8')).expect(200);
    const after = await Booking.findById(booking.id);
    expect(after.status).toBe(status || 'pending');
    expect(after.razorpayPaymentId).toBeUndefined();
  });
  test('rejects a body modified after signing', async () => {
    const booking = await makeBooking({ razorpayOrderId: 'order_123' });
    const body = paidEvent('order_123');
    const { raw, signature } = await hook(body);
    raw[raw.length - 2] = raw[raw.length - 2] === 49 ? 50 : 49;
    await request(app).post('/webhooks/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', signature).send(raw.toString('utf8')).expect(400, { error: 'Invalid signature' });
    expect((await Booking.findById(booking.id)).status).toBe('pending');
  });
});

describe('pending booking expiry and confirmed status ownership', () => {
  test('expires an old pending booking but keeps a recent one blocking', async () => {
    const oldStart = startAt();
    const old = await makeBooking({ startsAt: oldStart, createdAt: new Date(Date.now() - 20 * 60 * 1000) });
    await Booking.updateOne({ _id: old.id }, { $set: { createdAt: new Date(Date.now() - 20 * 60 * 1000) } });
    await request(app).post('/bookings').set('Authorization', auth('another')).send({ courtId: 'court-1', startsAt: oldStart.toISOString() }).expect(201);
    expect((await Booking.findById(old.id)).status).toBe('cancelled');

    const recentStart = new Date(+startAt() + 3600000);
    await makeBooking({ startsAt: recentStart });
    await request(app).post('/bookings').set('Authorization', auth('another')).send({ courtId: 'court-1', startsAt: recentStart.toISOString() }).expect(409);
  });
  test('create ignores body status and cancel cannot confirm', async () => {
    const start = startAt();
    const created = await request(app).post('/bookings').set('Authorization', auth()).send({ courtId: 'court-1', startsAt: start.toISOString(), status: 'confirmed' }).expect(201);
    expect(created.body.status).toBe('pending');
    const cancelled = await request(app).patch(`/bookings/${created.body._id}/cancel`).set('Authorization', auth()).send({ status: 'confirmed' }).expect(200);
    expect(cancelled.body.status).toBe('cancelled');
  });
});
