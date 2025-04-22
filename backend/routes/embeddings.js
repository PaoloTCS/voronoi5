const express = require('express');
const router = express.Router();
const embeddingController = require('../controllers/embeddingController');

// POST /api/embeddings - Get embeddings for domains
router.post('/', embeddingController.getEmbeddings);

module.exports = router;