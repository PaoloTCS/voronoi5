const express = require('express');
const router = express.Router();
const { calculateDistance } = require('../controllers/distanceController');

// POST /api/distance/calculate
router.post('/calculate', calculateDistance);

module.exports = router; 