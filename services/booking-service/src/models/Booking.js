const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    courtId: { type: String, required: true },
    courtName: { type: String, required: true },
    userId: { type: String, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    depositAmount: { type: Number, default: () => Number(process.env.DEPOSIT_PAISE) || 5000 },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
  },
  { timestamps: true }
);

bookingSchema.index(
  { courtId:  1, startsAt: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } }
);

module.exports = mongoose.model('Booking', bookingSchema);
