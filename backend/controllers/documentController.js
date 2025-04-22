// backend/controllers/documentController.js
const documentProcessingService = require('../services/documentProcessingService');

exports.uploadDocument = async (req, res) => {
    try {
      const { path } = req.body;
      const file = req.file;
      
      if (!file || !path) {
        return res.status(400).json({ error: 'Missing file or path' });
      }
      
      console.log(`Processing document: ${file.originalname} for path: ${path}`);
      
      // Process the document to extract text content
      const extractedText = await documentProcessingService.processDocument(
        file.buffer,
        file.originalname,
        file.mimetype
      );
      
      // In a real implementation, you would store both the original file
      // and the extracted text in a database or file system
      
      res.json({ 
        success: true, 
        message: 'Document processed successfully',
        fileName: file.originalname,
        textContent: extractedText,
        contentType: file.mimetype
      });
    } catch (error) {
      console.error('Error processing document:', error);
      res.status(500).json({ error: `Error processing document: ${error.message}` });
    }
  };