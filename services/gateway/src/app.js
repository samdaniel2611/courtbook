const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:4200' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

function unavailable(_err, _req, res) {
  console.error('Upstream service unavailable');
  if (!res.headersSent) res.status(502).json({ error: 'Upstream service unavailable' });
}

function proxy(target, prefix) {
  return createProxyMiddleware({
    target,
    timeout: 10000,
    proxyTimeout: 10000,
    pathRewrite: (path) => `${prefix}${path === '/' ? '' : path}`,
    on: { error: unavailable },
  });
}

app.use('/auth', proxy(process.env.AUTH_SERVICE_URL, '/auth'));
app.use('/venues', proxy(process.env.VENUE_SERVICE_URL, '/courts'));
app.use('/bookings', proxy(process.env.BOOKING_SERVICE_URL, '/bookings'));
app.use('/webhooks/razorpay', proxy(process.env.BOOKING_SERVICE_URL, '/webhooks/razorpay'));

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

module.exports = app;
