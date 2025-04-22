/**
 * Document search service for finding documents related to semantic triangle interiors
 */

import { calculateSimilarity } from './embeddingService';

/**
 * Search for documents that would fit at a specific point in semantic space
 * @param {Array} combinedEmbedding - The embedding vector of the interior point
 * @param {Array} documents - Array of all available documents to search through
 * @param {Array} excludeDocIds - Document IDs to exclude from search (e.g., triangle vertices)
 * @param {Number} threshold - Minimum similarity threshold
 * @param {Number} maxResults - Maximum number of results to return
 * @returns {Array} - Matching documents with similarity scores
 */
export const findMatchingDocuments = (
  combinedEmbedding, 
  documents = [], 
  excludeDocIds = [],
  threshold = 0.7,
  maxResults = 5
) => {
  if (!combinedEmbedding || documents.length === 0) {
    return [];
  }
  
  // Calculate similarity between the interior point and each document
  const documentsWithScores = documents
    .filter(doc => !excludeDocIds.includes(doc.id))
    .map(doc => {
      // Get document embedding (or generate it if not present)
      const docEmbedding = doc.embedding || doc.getEmbedding();
      
      // Calculate similarity
      const similarity = calculateSimilarity(combinedEmbedding, docEmbedding);
      
      return {
        document: doc,
        similarity
      };
    })
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
    
  return documentsWithScores;
};

/**
 * Generate a hypothetical document from a semantic interior point
 * @param {Array} combinedEmbedding - The embedding vector of the interior point
 * @param {Object} contributions - The document contributions data
 * @returns {Object} - Hypothetical document 
 */
export const generateHypotheticalDocument = (combinedEmbedding, contributions) => {
  // Create a title based on the contributing documents
  const contributingDocs = Object.entries(contributions)
    .sort((a, b) => b[1] - a[1]) // Sort by weight descending
    .map(([title, weight]) => ({ title, weight }));
  
  // Generate title based on contributions
  let title = 'Hypothetical: ';
  
  if (contributingDocs.length === 0) {
    title += 'Unknown document';
  } else if (contributingDocs[0].weight > 0.7) {
    // Dominant document
    title += `Variant of ${contributingDocs[0].title}`;
  } else if (contributingDocs.length >= 2 && 
            contributingDocs[0].weight < 0.6 && 
            contributingDocs[1].weight > 0.3) {
    // Combination of top 2
    title += `Intersection of ${contributingDocs[0].title} and ${contributingDocs[1].title}`;
  } else {
    // Complex mixture
    title += `Mixture of ${contributingDocs.map(d => d.title).join(', ')}`;
  }
  
  return {
    id: `hypothetical-${Date.now()}`,
    title,
    isHypothetical: true,
    embedding: combinedEmbedding,
    contributingDocs
  };
};

/**
 * Suggest search terms for finding documents at a specific semantic position
 * @param {Object} semantics - Semantic interpretation of the point
 * @param {Array} allDocuments - All available documents
 * @returns {Array} - Suggested search terms
 */
export const suggestSearchTerms = (semantics, allDocuments = []) => {
  if (!semantics || !semantics.contributions || !semantics.setOperation) {
    return [];
  }
  
  const topContributions = semantics.contributions
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);
    
  // Get keywords from the top contributing documents
  const keywordSets = topContributions.map(contribution => {
    const document = allDocuments.find(doc => doc.id === contribution.id);
    if (!document || !document.getKeywords) return [];
    
    return document.getKeywords(10).map(k => ({ 
      ...k, 
      weight: contribution.weight 
    }));
  });
  
  // Combine keywords based on contribution weights
  const combinedKeywords = {};
  keywordSets.forEach((keywords, i) => {
    const weight = topContributions[i].weight;
    
    keywords.forEach(keyword => {
      if (!combinedKeywords[keyword.word]) {
        combinedKeywords[keyword.word] = 0;
      }
      combinedKeywords[keyword.word] += keyword.score * weight;
    });
  });
  
  // Convert back to array and sort
  const sortedTerms = Object.entries(combinedKeywords)
    .map(([word, score]) => ({ word, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
    
  return sortedTerms;
};

/**
 * Generate a search query based on semantic interior point
 * @param {Object} semantics - Semantic interpretation of the point
 * @returns {String} - Search query 
 */
export const generateSearchQuery = (semantics) => {
  if (!semantics || !semantics.contributions || !semantics.setOperation) {
    return '';
  }
  
  // Use set operation type to inform query structure
  const { type, description } = semantics.setOperation;
  let query = '';
  
  if (type === 'balanced_intersection') {
    // For balanced intersection, all terms are equally important
    const terms = semantics.contributions.map(c => c.title).join(' AND ');
    query = `(${terms})`;
  } else if (type === 'dominant_with_influence') {
    // For dominant with influence, prioritize the dominant document
    const sorted = [...semantics.contributions].sort((a, b) => b.weight - a.weight);
    query = `${sorted[0].title} AND (${sorted.slice(1).map(c => c.title).join(' OR ')})`;
  } else if (type === 'paired_intersection') {
    // For paired intersection, focus on the two main docs
    const sorted = [...semantics.contributions].sort((a, b) => b.weight - a.weight);
    query = `(${sorted[0].title} AND ${sorted[1].title})`;
  } else {
    // Default to weighted combination
    const terms = semantics.contributions
      .filter(c => c.weight > 0.2)
      .map(c => c.title)
      .join(' OR ');
    query = `(${terms})`;
  }
  
  return query;
}; 