const express = require('express');
const router = express.Router();
const { analyzePoint } = require('../controllers/analysisController');

// Define the route for point analysis
// POST /analyze-point (relative to where this router is mounted)
router.post('/analyze-point', analyzePoint);

module.exports = router; 