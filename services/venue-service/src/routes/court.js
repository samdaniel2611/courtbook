const express = require('express');
const mongoose = require('mongoose');
const Court = require('../models/Court');
const requireAuth = require('../middleware/auth');
const geocodeAddress = require('../geocode');

const router = express.Router();

function parseCourt(body, { coordinatesOptional = false } = {}) {
  const { name, sport, address, lat, lng } = body;

  if (typeof name !== 'string' || !name.trim()) return { error: 'name is required' };
  if (typeof sport !== 'string' || !sport.trim()) return { error: 'sport is required' };
  if (typeof address !== 'string' || !address.trim()) return { error: 'address is required' };
  const coordinatesMissing = lat === undefined && lng === undefined;
  if (coordinatesMissing && coordinatesOptional) {
    return { data: { name, sport, address } };
  }
  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    return { error: 'lat must be a number between -90 and 90' };
  }
  if (typeof lng !== 'number' || lng < -180 || lng > 180) {
    return { error: 'lng must be a number between -180 and 180' };
  }

  return { data: { name, sport, address, lat, lng } };
}

router.get('/', async (req, res) => {
  try {
    const courts = await Court.find().sort({ createdAt: -1 });
    res.json(courts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/nearby', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusKm = req.query.radiusKm === undefined ? 5 : Number(req.query.radiusKm);
  if (req.query.lat === undefined || String(req.query.lat).trim() === '' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({ error: 'Invalid lat' });
  }
  if (req.query.lng === undefined || String(req.query.lng).trim() === '' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Invalid lng' });
  }
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 50) {
    return res.status(400).json({ error: 'Invalid radiusKm' });
  }
  try {
    const filter = req.query.sport
      ? { sport: String(req.query.sport).toLowerCase() }
      : {};
    const courts = await Court.find({
      ...filter,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusKm * 1000,
        },
      },
    }).limit(50);
    res.json(courts);
  } catch (err) {
    console.error('Nearby court search failed');
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid court id' });
    }
    const court = await Court.findById(req.params.id);
    if (!court) return res.status(404).json({ error: 'Court not found' });
    res.json(court);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = parseCourt(req.body, { coordinatesOptional: true });
    if (error) return res.status(400).json({ error });

    if (data.lat === undefined) {
      try {
        const coordinates = await geocodeAddress(data.address);
        if (!coordinates) return res.status(400).json({ error: 'Could not find that address' });
        Object.assign(data, coordinates);
      } catch (_) {
        console.error('Court address geocoding failed');
        return res.status(502).json({ error: 'Geocoding service unavailable' });
      }
    }

    const court = await Court.create({ ...data, ownerId: req.user.id });
    res.status(201).json(court);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid court id' });
    }
    const { data, error } = parseCourt(req.body, { coordinatesOptional: true });
    if (error) return res.status(400).json({ error });

    const court = await Court.findById(req.params.id);
    if (!court) return res.status(404).json({ error: 'Court not found' });
    if (court.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this court' });
    }

    const addressChanged = data.address !== court.address;
    if (data.lat === undefined) {
      if (addressChanged) {
        try {
          const coordinates = await geocodeAddress(data.address);
          if (!coordinates) return res.status(400).json({ error: 'Could not find that address' });
          Object.assign(data, coordinates);
        } catch (_) {
          console.error('Court address geocoding failed');
          return res.status(502).json({ error: 'Geocoding service unavailable' });
        }
      } else {
        data.lat = court.lat;
        data.lng = court.lng;
      }
    }

    Object.assign(court, data);
    await court.save();
    res.json(court);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid court id' });
    }
    const court = await Court.findById(req.params.id);
    if (!court) return res.status(404).json({ error: 'Court not found' });
    if (court.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this court' });
    }

    await court.deleteOne();
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
