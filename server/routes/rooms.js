const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

/**
 * GET /api/rooms
 * Get all rooms
 */
router.get('/', (req, res) => {
  try {
    const rooms = db.statements.getAllRooms.all();
    res.json({
      success: true,
      data: rooms.map(room => ({
        ...room,
        config: db.parseJSON(room.config_json)
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rooms/:id
 * Get a specific room
 */
router.get('/:id', (req, res) => {
  try {
    const room = db.statements.getRoom.get(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    res.json({
      success: true,
      data: {
        ...room,
        config: db.parseJSON(room.config_json)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/rooms
 * Create a new room
 */
router.post('/', (req, res) => {
  try {
    const { name, config = {} } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'Room name is required' });
    }

    const id = uuidv4();
    const configJson = JSON.stringify(config);

    db.statements.createRoom.run(id, name, configJson);

    const room = db.statements.getRoom.get(id);

    res.status(201).json({
      success: true,
      data: {
        ...room,
        config: db.parseJSON(room.config_json)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/rooms/:id
 * Update a room
 */
router.put('/:id', (req, res) => {
  try {
    const { name, config = {} } = req.body;
    const configJson = JSON.stringify(config);

    db.statements.updateRoom.run(name, configJson, req.params.id);

    const room = db.statements.getRoom.get(req.params.id);

    res.json({
      success: true,
      data: {
        ...room,
        config: db.parseJSON(room.config_json)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/rooms/:id
 * Delete a room
 */
router.delete('/:id', (req, res) => {
  try {
    db.statements.deleteRoom.run(req.params.id);
    res.json({ success: true, message: 'Room deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
