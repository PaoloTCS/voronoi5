// backend/services/documentProcessingService.js
const pdfParse = require('pdf-parse');

/**
 * Extracts text content from different file types
 */
class DocumentProcessingService {
  /**
   * Process document content based on file type
   * @param {Buffer} buffer - The document buffer
   * @param {string} originalname - Original file name
   * @param {string} mimetype - MIME type of the file
   * @returns {Promise<string>} - Extracted text content
   */
  async processDocument(buffer, originalname, mimetype) {
    try {
      // Determine file type from mimetype or filename extension
      if (mimetype === 'application/pdf' || originalname.toLowerCase().endsWith('.pdf')) {
        return await this.processPdf(buffer);
      } else if (
        mimetype === 'application/msword' || 
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        originalname.toLowerCase().endsWith('.doc') ||
        originalname.toLowerCase().endsWith('.docx')
      ) {
        // For now, we're just returning a placeholder for Word documents
        // In a production app, you would integrate with a Word doc parsing library
        return `[Content extracted from Word document: ${originalname}]\n\nThis is placeholder text. To properly handle Word documents, integrate with a Word document parsing library.`;
      } else {
        // For text files and other formats, return as string
        return buffer.toString('utf-8');
      }
    } catch (error) {
      console.error('Error processing document:', error);
      throw new Error(`Failed to process document: ${error.message}`);
    }
  }

  /**
   * Process PDF documents using pdf-parse
   * @param {Buffer} buffer - PDF buffer
   * @returns {Promise<string>} - Extracted text
   */
  async processPdf(buffer) {
    try {
      const data = await pdfParse(buffer);
      return data.text || 'No text content could be extracted from this PDF';
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }
}

module.exports = new DocumentProcessingService();