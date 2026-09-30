process.env.JWT_SECRET = 'test-secret';
process.env.MONGO_URI = 'mongodb://localhost:27017/venue_test_db';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../src/app');
const Court = require('../src/models/Court');
const connectDB = require('../src/db');

beforeAll(async () => {
  await connectDB();
  await Court.init();
});

afterEach(async () => {
  await Court.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const validCourt = {
  name: 'Central Court',
  sport: 'Tennis',
  address: '12 Main Street',
  lat: 12.9716,
  lng: 77.5946,
};

function tokenFor(id) {
  return jwt.sign({ sub: id, email: `${id}@example.com` }, process.env.JWT_SECRET);
}

describe('GET /courts', () => {
  it('returns the public court list', async () => {
    const court = await Court.create({ ...validCourt, ownerId: 'owner-1' });

    const res = await request(app).get('/courts');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]._id).toBe(court.id);
  });
});

describe('GET /courts/:id', () => {
  it('returns a court by id publicly', async () => {
    const court = await Court.create({ ...validCourt, ownerId: 'owner-1' });

    const res = await request(app).get(`/courts/${court.id}`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(court.id);
    expect(res.body.name).toBe(validCourt.name);
  });
});

describe('POST /courts', () => {
  it('requires a token', async () => {
    const res = await request(app).post('/courts').send(validCourt);

    expect(res.status).toBe(401);
  });

  it('rejects invalid court fields with 400', async () => {
    const res = await request(app)
      .post('/courts')
      .set('Authorization', `Bearer ${tokenFor('owner-1')}`)
      .send({ ...validCourt, lat: 91 });

    expect(res.status).toBe(400);
  });
});

describe('PUT /courts/:id', () => {
  it('returns 403 when the requester does not own the court', async () => {
    const court = await Court.create({ ...validCourt, ownerId: 'owner-1' });

    const res = await request(app)
      .put(`/courts/${court.id}`)
      .set('Authorization', `Bearer ${tokenFor('owner-2')}`)
      .send(validCourt);

    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown court id', async () => {
    const unknownId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .put(`/courts/${unknownId}`)
      .set('Authorization', `Bearer ${tokenFor('owner-1')}`)
      .send(validCourt);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /courts/:id', () => {
  it('returns 403 when the requester does not own the court', async () => {
    const court = await Court.create({ ...validCourt, ownerId: 'owner-1' });

    const res = await request(app)
      .delete(`/courts/${court.id}`)
      .set('Authorization', `Bearer ${tokenFor('owner-2')}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown court id', async () => {
    const unknownId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .delete(`/courts/${unknownId}`)
      .set('Authorization', `Bearer ${tokenFor('owner-1')}`);

    expect(res.status).toBe(404);
  });
});
