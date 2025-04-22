const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');

// POST /api/analysis/triangle-2d
// Body: { documentIds: ["id1", "id2", "id3"] }
router.post('/triangle-2d', analysisController.getTriangle2D);

// TODO: Add routes for other analysis types (3D, etc.) later

module.exports = router; 