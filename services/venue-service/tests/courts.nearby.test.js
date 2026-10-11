jest.mock('../src/geocode', () => jest.fn());

process.env.JWT_SECRET = 'test-secret';
process.env.MONGO_URI = 'mongodb://localhost:27017/venue_test_db';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../src/app');
const Court = require('../src/models/Court');
const connectDB = require('../src/db');
const geocodeAddress = require('../src/geocode');

const baseCourt = {
  name: 'Central Court',
  sport: 'Tennis',
  address: '12 Main Street',
};

function tokenFor(id = 'owner-1') {
  return jwt.sign({ sub: id, email: `${id}@example.com` }, process.env.JWT_SECRET);
}

function createCourt(overrides = {}) {
  return Court.create({
    ...baseCourt,
    lat: 12.9716,
    lng: 77.5946,
    ownerId: 'owner-1',
    ...overrides,
  });
}

beforeAll(async () => {
  await connectDB();
  await Court.init();
});

beforeEach(() => {
  geocodeAddress.mockReset();
});

afterEach(async () => {
  await Court.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('geocoding courts', () => {
  it('creates a court without coordinates using the geocoder result', async () => {
    geocodeAddress.mockResolvedValue({ lat: 12.9716, lng: 77.5946 });
    const res = await request(app)
      .post('/courts')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send(baseCourt);

    expect(res.status).toBe(201);
    expect(res.body.lat).toBe(12.9716);
    expect(res.body.lng).toBe(77.5946);
    expect(geocodeAddress).toHaveBeenCalledWith(baseCourt.address);
  });

  it('does not geocode when create coordinates are supplied', async () => {
    const res = await request(app)
      .post('/courts')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({ ...baseCourt, lat: 12.9716, lng: 77.5946 });

    expect(res.status).toBe(201);
    expect(geocodeAddress).not.toHaveBeenCalled();
  });

  it('returns 400 when geocoding finds no result', async () => {
    geocodeAddress.mockResolvedValue(null);
    const res = await request(app)
      .post('/courts')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send(baseCourt);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Could not find that address' });
  });

  it('returns a safe 502 response when geocoding throws', async () => {
    geocodeAddress.mockRejectedValue(new Error('apiKey leaked internally'));
    const res = await request(app)
      .post('/courts')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send(baseCourt);

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Geocoding service unavailable' });
    expect(JSON.stringify(res.body)).not.toMatch(/apiKey/i);
  });

  it('re-geocodes on update only when the address changes without coordinates', async () => {
    const court = await createCourt();
    geocodeAddress.mockResolvedValue({ lat: 13, lng: 78 });
    const res = await request(app)
      .put(`/courts/${court.id}`)
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({ ...baseCourt, address: 'New address' });

    expect(res.status).toBe(200);
    expect(geocodeAddress).toHaveBeenCalledWith('New address');
    expect(res.body.lat).toBe(13);
    expect(res.body.lng).toBe(78);
  });
});

describe('GET /courts/nearby', () => {
  it('returns courts inside the radius and excludes courts outside it', async () => {
    const nearby = await createCourt({ name: 'Near' });
    await createCourt({ name: 'Far', lat: 13.2, lng: 77.5946 });

    const res = await request(app).get('/courts/nearby?lat=12.9716&lng=77.5946&radiusKm=5');

    expect(res.status).toBe(200);
    expect(res.body.map((court) => court._id)).toEqual([nearby.id]);
  });

  it('sorts matching courts nearest first', async () => {
    const farther = await createCourt({ name: 'Farther', lat: 12.98 });
    const closer = await createCourt({ name: 'Closer', lat: 12.972 });

    const res = await request(app).get('/courts/nearby?lat=12.9716&lng=77.5946');

    expect(res.status).toBe(200);
    expect(res.body.map((court) => court._id)).toEqual([closer.id, farther.id]);
  });

  it('filters by lowercased sport', async () => {
    const tennis = await createCourt({ sport: 'tennis' });
    await createCourt({ sport: 'football' });

    const res = await request(app).get('/courts/nearby?lat=12.9716&lng=77.5946&sport=TeNnIs');

    expect(res.status).toBe(200);
    expect(res.body.map((court) => court._id)).toEqual([tennis.id]);
  });

  it.each([
    ['lat', '91', 'lng=77.5946'],
    ['lng', '181', 'lat=12.9716'],
    ['radiusKm', '51', 'lat=12.9716&lng=77.5946'],
  ])('returns 400 for invalid %s', async (param, value, otherParams) => {
    const res = await request(app).get(`/courts/nearby?${otherParams}&${param}=${value}`);
    expect(res.status).toBe(400);
  });

  it('is routed before /:id', async () => {
    const res = await request(app).get('/courts/nearby?lat=0&lng=0');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
