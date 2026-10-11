const mongoose = require('mongoose');

const courtSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sport: { type: String, required: true, trim: true, lowercase: true },
    address: { type: String, required: true, trim: true },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    ownerId: { type: String, required: true },
  },
  { timestamps: true }
);

courtSchema.index({ location: '2dsphere' });

courtSchema.pre('validate', function syncLocation() {
  if (typeof this.lng === 'number' && typeof this.lat === 'number') {
    this.location = { type: 'Point', coordinates: [this.lng, this.lat] };
  }
});

module.exports = mongoose.model('Court', courtSchema);
