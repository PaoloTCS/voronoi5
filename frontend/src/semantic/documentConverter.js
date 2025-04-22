/**
 * Utility to convert various document formats to a standardized format
 * for semantic visualization components
 */
import Document from '../models/Document';

/**
 * Convert domain documents to the Document model format required by visualization components
 * @param {Array} domainDocuments - Documents from the domain context
 * @returns {Array} - Array of Document instances
 */
export const convertDomainDocumentsToModelFormat = (domainDocuments = []) => {
  if (!domainDocuments || domainDocuments.length === 0) {
    console.log('No domain documents provided to converter');
    return [];
  }
  
  console.log('Converting domain documents:', domainDocuments);
  
  // Filter out any null or undefined documents
  const validDocs = domainDocuments.filter(doc => doc !== null && doc !== undefined);
  console.log(`Found ${validDocs.length} valid domain documents out of ${domainDocuments.length}`);
  
  const convertedDocs = validDocs.map(doc => {
    // Extract content based on document format
    let content = '';
    
    if (typeof doc.content === 'string') {
      content = doc.content;
    } else if (doc.content?.text) {
      content = doc.content.text;
    } else if (doc.content?.preview) {
      content = doc.content.preview;
    }
    
    // Create a proper Document instance
    return new Document({
      id: `doc::${doc.name}`,
      title: doc.name,
      content: content,
      metadata: {
        domain: 'Physics', // Default domain
        originalType: doc.content?.originalType || doc.content?.type || 'text',
        isUserDocument: true
      }
    });
  });
  
  console.log(`Successfully converted ${convertedDocs.length} documents`);
  return convertedDocs;
};

/**
 * Convert external paper data to the Document model format
 * @param {Array} externalPapers - External papers from the domain context
 * @returns {Array} - Array of Document instances
 */
export const convertExternalPapersToModelFormat = (externalPapers = []) => {
  if (!externalPapers || externalPapers.length === 0) {
    return [];
  }
  
  console.log('Converting external papers:', externalPapers);
  
  // Filter out any null or undefined papers
  const validPapers = externalPapers.filter(paper => paper !== null && paper !== undefined);
  console.log(`Found ${validPapers.length} valid external papers out of ${externalPapers.length}`);
  
  const convertedPapers = validPapers.map(paper => {
    // Create content from paper data
    const content = `
      Title: ${paper.title}
      Authors: ${paper.authors || 'Unknown'}
      Published: ${paper.published || 'Unknown'}
      
      Summary: ${paper.summary || 'No summary available.'}
      
      Link: ${paper.link || 'No link available.'}
    `;
    
    // Create a proper Document instance
    return new Document({
      id: `ext::${paper.id}`,
      title: paper.title,
      content: content,
      metadata: {
        domain: 'Physics', // Default domain
        externalPaper: true,
        authors: paper.authors,
        published: paper.published,
        link: paper.link
      }
    });
  });
  
  console.log(`Successfully converted ${convertedPapers.length} external papers`);
  return convertedPapers;
};

/**
 * Get all available documents from the domain
 * @param {Function} getCurrentDocuments - Function to get current documents
 * @param {String} currentPath - Current path in string format
 * @param {Object} externalPapers - External papers object
 * @returns {Array} - Array of Document instances
 */
export const getAllAvailableDocuments = (getCurrentDocuments, currentPath, externalPapers = {}) => {
  console.log('Getting all available documents, path:', currentPath);
  
  // Get documents from current domain
  const domainDocuments = getCurrentDocuments() || [];
  console.log(`Found ${domainDocuments.length} domain documents`);
  
  // Check if any documents are selected in checkboxes
  const selectedDocs = domainDocuments.filter(doc => doc.selected === true);
  console.log(`${selectedDocs.length} documents are selected`);
  
  // Get external papers for current domain
  const currentExternalPapers = externalPapers[currentPath] || [];
  console.log(`Found ${currentExternalPapers.length} external papers`);
  
  // Convert both to Document model format
  const convertedDomainDocs = convertDomainDocumentsToModelFormat(
    // If there are selected documents, use only those, otherwise use all
    selectedDocs.length > 0 ? selectedDocs : domainDocuments
  );
  const convertedExternalPapers = convertExternalPapersToModelFormat(currentExternalPapers);
  
  // Combine all documents
  const allDocs = [...convertedDomainDocs, ...convertedExternalPapers];
  console.log(`Returning total of ${allDocs.length} documents`);
  
  return allDocs;
}; 