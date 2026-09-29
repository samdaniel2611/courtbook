const express = require('express');
const mongoose = require('mongoose');
const Court = require('../models/Court');
const requireAuth = require('../middleware/auth');

const router = express.Router();

function parseCourt(body) {
  const { name, sport, address, lat, lng } = body;

  if (typeof name !== 'string' || !name.trim()) return { error: 'name is required' };
  if (typeof sport !== 'string' || !sport.trim()) return { error: 'sport is required' };
  if (typeof address !== 'string' || !address.trim()) return { error: 'address is required' };
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
    const { data, error } = parseCourt(req.body);
    if (error) return res.status(400).json({ error });

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
    const { data, error } = parseCourt(req.body);
    if (error) return res.status(400).json({ error });

    const court = await Court.findById(req.params.id);
    if (!court) return res.status(404).json({ error: 'Court not found' });
    if (court.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this court' });
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