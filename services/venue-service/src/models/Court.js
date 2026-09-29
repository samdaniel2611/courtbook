const mongoose = require('mongoose');

const courtSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sport: { type: String, required: true, trim: true, lowercase: true },
    address: { type: String, required: true, trim: true },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    ownerId: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Court', courtSchema);