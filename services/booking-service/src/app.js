const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Booking = require('./models/Booking');
const bookingRoutes = require('./routes/bookings');

const app = express();
app.use(cors());
app.post('/webhooks/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.get('X-Razorpay-Signature');
  if (typeof signature !== 'string' || !Buffer.isBuffer(req.body) || !process.env.RAZORPAY_WEBHOOK_SECRET) {
    return res.status(400).json({ error: 'Invalid signature' });
  }
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(req.body).digest();
  let supplied;
  try { supplied = Buffer.from(signature, 'hex'); } catch (_err) { supplied = Buffer.alloc(0); }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let payload;
  try { payload = JSON.parse(req.body.toString('utf8')); } catch (_err) { return res.status(400).json({ error: 'Invalid payload' }); }
  if (payload.event !== 'order.paid') return res.sendStatus(200);
  const orderId = payload?.payload?.order?.entity?.id;
  const payment = payload?.payload?.payment?.entity;
  if (!orderId || !payment?.id) return res.sendStatus(200);
  try {
    const booking = await Booking.findOne({ razorpayOrderId: orderId });
    if (!booking) return res.sendStatus(200);
    if (payment.amount !== booking.depositAmount) {
      console.error('Razorpay payment amount mismatch');
      return res.sendStatus(200);
    }
    if (booking.status === 'confirmed') return res.sendStatus(200);
    if (booking.status === 'cancelled') {
      console.error('Payment received for cancelled booking');
      return res.sendStatus(200);
    }
    if (booking.status !== 'pending') return res.sendStatus(200);
    booking.status = 'confirmed';
    booking.razorpayPaymentId = payment.id;
    booking.paidAt = new Date();
    await booking.save();
    return res.sendStatus(200);
  } catch (_err) {
    console.error('Razorpay webhook processing failed');
    return res.sendStatus(500);
  }
});
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/bookings', bookingRoutes);

module.exports = app;
