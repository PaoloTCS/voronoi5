const express = require('express');
const router = express.Router();
const { getExternalResources } = require('../controllers/externalQueryController');

// GET /api/external/papers -> Renamed to /api/external/resources
// This endpoint now dynamically fetches from arXiv, PubMed, or Wikipedia based on context
router.get('/resources', getExternalResources);

module.exports = router; 