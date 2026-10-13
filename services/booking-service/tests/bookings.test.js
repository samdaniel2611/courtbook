process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/booking_test_db';
process.env.JWT_SECRET = 'booking-test-secret';
process.env.VENUE_SERVICE_URL = 'http://venue.test';

jest.mock('axios');

const axios = require('axios');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const Booking = require('../src/models/Booking');

const tokenFor = (sub, secret = process.env.JWT_SECRET) => jwt.sign({ email: `${sub}@example.test` }, secret, { subject: sub });
const auth = (sub = 'user-1') => `Bearer ${tokenFor(sub)}`;
const nextHour = () => {
  const date = new Date();
  date.setUTCHours(date.getUTCHours() + 2, 0, 0, 0);
  return date.toISOString();
};
const court = { _id: 'court-1', name: 'Center Court' };

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Booking.init();
});

afterEach(async () => {
  await Booking.deleteMany({});
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(() => {
  axios.get.mockResolvedValue({ data: court });
});

describe('booking authentication', () => {
  test('returns 401 without a token', async () => {
    await request(app).get('/bookings').expect(401);
  });

  test('returns 401 for a token signed by the wrong secret', async () => {
    await request(app).get('/bookings').set('Authorization', `Bearer ${tokenFor('user-1', 'wrong-secret')}`).expect(401);
  });
});

describe('POST /bookings', () => {
  test('creates a pending booking with server-owned values', async () => {
    const startsAt = nextHour();
    const response = await request(app).post('/bookings').set('Authorization', auth()).send({ courtId: 'court-1', startsAt }).expect(201);
    expect(response.body.userId).toBe('user-1');
    expect(response.body.status).toBe('pending');
    expect(response.body.courtName).toBe('Center Court');
    expect(new Date(response.body.endsAt).getTime() - new Date(response.body.startsAt).getTime()).toBe(3600000);
    expect(axios.get).toHaveBeenCalledWith('http://venue.test/courts/court-1', { timeout: 5000 });
  });

  test('ignores client-supplied protected fields', async () => {
    const response = await request(app).post('/bookings').set('Authorization', auth()).send({
      courtId: 'court-1', startsAt: nextHour(), status: 'confirmed', userId: 'attacker', courtName: 'Fake', endsAt: '2030-01-01', depositAmount: 1,
    }).expect(201);
    expect(response.body.userId).toBe('user-1');
    expect(response.body.status).toBe('pending');
    expect(response.body.courtName).toBe('Center Court');
    expect(response.body.endsAt).not.toBe('2030-01-01');
    expect(response.body.depositAmount).toBe(5000);
  });

  test.each([
    ['missing courtId', { startsAt: '2030-01-01T10:00:00.000Z' }],
    ['bad date', { courtId: 'court-1', startsAt: 'not-a-date' }],
    ['not on the hour', { courtId: 'court-1', startsAt: '2030-01-01T10:30:00.000Z' }],
    ['past date', { courtId: 'court-1', startsAt: '2000-01-01T10:00:00.000Z' }],
  ])('returns 400 for %s', async (_label, body) => {
    await request(app).post('/bookings').set('Authorization', auth()).send(body).expect(400);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('returns 404 when venue service reports a missing court', async () => {
    axios.get.mockRejectedValue({ response: { status: 404 } });
    await request(app).post('/bookings').set('Authorization', auth()).send({ courtId: 'missing', startsAt: nextHour() }).expect(404, { error: 'Court not found' });
  });

  test('returns a sanitized 502 when venue service fails', async () => {
    axios.get.mockRejectedValue(new Error('failed https://venue.test?key=secret-value'));
    const response = await request(app).post('/bookings').set('Authorization', auth()).send({ courtId: 'court-1', startsAt: nextHour() }).expect(502);
    expect(JSON.stringify(response.body)).not.toMatch(/https?:|secret-value|key/i);
  });

  test('rejects a duplicate slot but allows a different court at the same time', async () => {
    const startsAt = nextHour();
    await request(app).post('/bookings').set('Authorization', auth('user-1')).send({ courtId: 'court-1', startsAt }).expect(201);
    await request(app).post('/bookings').set('Authorization', auth('user-2')).send({ courtId: 'court-1', startsAt }).expect(409, { error: 'Slot already booked' });
    await request(app).post('/bookings').set('Authorization', auth('user-2')).send({ courtId: 'court-2', startsAt }).expect(201);
  });

  test('allows the slot to be booked after cancellation', async () => {
    const startsAt = nextHour();
    const created = await request(app).post('/bookings').set('Authorization', auth()).send({ courtId: 'court-1', startsAt }).expect(201);
    await request(app).patch(`/bookings/${created.body._id}/cancel`).set('Authorization', auth()).expect(200);
    await request(app).post('/bookings').set('Authorization', auth('user-2')).send({ courtId: 'court-1', startsAt }).expect(201);
  });
});

describe('booking reads and cancellation', () => {
  test('lists only the caller bookings', async () => {
    const slot = new Date(nextHour());
    await Booking.create([{ courtId: 'c1', courtName: 'One', userId: 'user-1', startsAt: slot, endsAt: new Date(+slot + 3600000) }, { courtId: 'c2', courtName: 'Two', userId: 'user-2', startsAt: slot, endsAt: new Date(+slot + 3600000) }]);
    const response = await request(app).get('/bookings').set('Authorization', auth('user-1')).expect(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].userId).toBe('user-1');
  });

  test('hides another user booking from GET /:id', async () => {
    const slot = new Date(nextHour());
    const booking = await Booking.create({ courtId: 'c1', courtName: 'One', userId: 'user-2', startsAt: slot, endsAt: new Date(+slot + 3600000) });
    await request(app).get(`/bookings/${booking.id}`).set('Authorization', auth('user-1')).expect(404);
  });

  test('validates ids, allows owner cancellation, and hides another user booking on cancel', async () => {
    await request(app).get('/bookings/not-an-id').set('Authorization', auth()).expect(400);
    const slot = new Date(nextHour());
    const owned = await Booking.create({ courtId: 'c1', courtName: 'One', userId: 'user-1', startsAt: slot, endsAt: new Date(+slot + 3600000) });
    const other = await Booking.create({ courtId: 'c2', courtName: 'Two', userId: 'user-2', startsAt: slot, endsAt: new Date(+slot + 3600000) });
    const response = await request(app).patch(`/bookings/${owned.id}/cancel`).set('Authorization', auth('user-1')).expect(200);
    expect(response.body.status).toBe('cancelled');
    await request(app).patch(`/bookings/${other.id}/cancel`).set('Authorization', auth('user-1')).expect(404);
  });
});
