const express = require('express');
const router = express.Router();
const multer = require('multer');
const documentController = require('../controllers/documentController');

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/documents - Upload and process document
router.post('/', upload.single('file'), documentController.uploadDocument);

module.exports = router;