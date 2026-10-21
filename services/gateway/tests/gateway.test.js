const http = require('http');
const request = require('supertest');

const upstreams = {};
let app;

function startUpstream() {
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        method: req.method,
        path: req.url,
        authorization: req.headers.authorization,
        signature: req.headers['x-razorpay-signature'],
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function serviceUrl(server) {
  return `http://127.0.0.1:${server.address().port}`;
}

function closeServer(server) {
  return new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
}

beforeAll(async () => {
  upstreams.auth = await startUpstream();
  upstreams.venue = await startUpstream();
  upstreams.booking = await startUpstream();
  process.env.AUTH_SERVICE_URL = serviceUrl(upstreams.auth);
  process.env.VENUE_SERVICE_URL = serviceUrl(upstreams.venue);
  process.env.BOOKING_SERVICE_URL = serviceUrl(upstreams.booking);
  process.env.CORS_ORIGIN = 'http://localhost:4200';
  app = require('../src/app');
});

afterAll(async () => {
  await Promise.all(Object.values(upstreams).filter((server) => server.listening).map(closeServer));
});

test('routes auth requests and forwards Authorization', async () => {
  const response = await request(app).get('/auth/login').set('Authorization', 'Bearer sample-token').expect(200);
  expect(response.body.path).toBe('/auth/login');
  expect(response.body.authorization).toBe('Bearer sample-token');
});

test('rewrites venue paths and preserves query strings', async () => {
  const nearby = await request(app).get('/venues/nearby?lat=1&lng=2').expect(200);
  expect(nearby.body.path).toBe('/courts/nearby?lat=1&lng=2');
  const venue = await request(app).get('/venues/abc').expect(200);
  expect(venue.body.path).toBe('/courts/abc');
  const root = await request(app).get('/venues').expect(200);
  expect(root.body.path).toBe('/courts');
});

test('routes the bookings root to /bookings', async () => {
  const response = await request(app).get('/bookings').expect(200);
  expect(response.body.path).toBe('/bookings');
});

test('forwards webhook bytes and signature header unchanged', async () => {
  const body = '{  "z": 1, "a" : [ 2,3 ] }';
  const signature = 'signed-test-value';
  const response = await request(app).post('/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', signature)
    .send(body)
    .expect(200);
  expect(response.body.path).toBe('/webhooks/razorpay');
  expect(response.body.signature).toBe(signature);
  expect(response.body.body).toBe(body);
});

test('returns 502 with a clean body when an upstream is stopped', async () => {
  await closeServer(upstreams.booking);
  const response = await request(app).get('/bookings').expect(502);
  expect(response.body).toEqual({ error: 'Upstream service unavailable' });
});

test('answers health locally and rejects unknown routes', async () => {
  await request(app).get('/health').expect(200, { status: 'ok' });
  await request(app).get('/missing').expect(404, { error: 'Not found' });
});

test('CORS allows the configured origin', async () => {
  const response = await request(app).get('/health').set('Origin', 'http://localhost:4200').expect(200);
  expect(response.headers['access-control-allow-origin']).toBe('http://localhost:4200');
});
