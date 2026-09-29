process.env.JWT_SECRET = 'test-secret';
process.env.MONGO_URI = 'mongodb://localhost:27017/auth_test_db';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const connectDB = require('../db');

beforeAll(async () => {
  await connectDB();
  await User.init();
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const validUser = { email: 'test@example.com', password: 'password123' };

describe('POST /auth/register', () => {
  it('creates a user and does not leak the password', async () => {
    const res = await request(app).post('/auth/register').send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('test@example.com');
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.body.password).toBeUndefined();
  });

  it('rejects a password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'a@b.com', password: 'short' });

    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/auth/register').send(validUser);
    const res = await request(app).post('/auth/register').send(validUser);

    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register').send(validUser);
  });

  it('returns a valid JWT for correct credentials', async () => {
    const res = await request(app).post('/auth/login').send(validUser);

    expect(res.status).toBe(200);
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.sub).toBeDefined();
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpass1' });

    expect(res.status).toBe(401);
  });

  it('gives the same error for an unknown email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });
});