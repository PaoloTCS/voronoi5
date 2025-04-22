/**
 * Semantic embedding service
 * Provides document embedding functionality with deterministic positioning
 */

// In a production environment, this would use a real embedding model API
// For now, we'll create deterministic embeddings based on document content

/**
 * Generate a fixed embedding vector for a document
 * @param {Object} document - Document object with content
 * @returns {Array} - Embedding vector
 */
export const generateEmbedding = (document) => {
  if (!document || !document.content) {
    return Array(128).fill(0); // Default empty embedding
  }
  
  // Use content to generate a deterministic "embedding"
  // This is a simplification - real embeddings would come from a language model
  const content = document.content.toLowerCase();
  
  // Create a simple but deterministic embedding based on word frequencies
  const commonKeywords = [
    'art', 'science', 'history', 'technology', 'philosophy', 'mathematics',
    'data', 'research', 'analysis', 'theory', 'design', 'system', 'method',
    'knowledge', 'information', 'concept', 'structure', 'function', 'development',
    'application', 'process', 'model', 'problem', 'solution'
  ];
  
  // Generate embedding values based on keyword presence
  const embedding = Array(128).fill(0);
  
  commonKeywords.forEach((keyword, i) => {
    const count = (content.match(new RegExp(keyword, 'g')) || []).length;
    // Distribute keyword influence across embedding dimensions
    for (let j = 0; j < 5; j++) {
      const index = (i * 5 + j) % embedding.length;
      embedding[index] = count * 0.1 + (embedding[index] || 0);
    }
  });
  
  // --- ADDED: Incorporate content hash ---
  const hashValue = simpleHash(content);
  // Use hash to seed some embedding dimensions deterministically
  embedding[1] = (hashValue & 0xFF) / 255; // Use lower bits for dim 1
  embedding[2] = ((hashValue >> 8) & 0xFF) / 255; // Use next bits for dim 2
  // --- END HASH ---

  // Add document length influence
  embedding[0] = Math.min(1.0, content.length * 0.0001); // Normalize length influence a bit
  
  // Normalize the embedding
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 
    ? embedding.map(val => val / magnitude) 
    : embedding;
};

/**
 * Calculate cosine similarity between two embedding vectors
 * @param {Array} vec1 - First embedding vector
 * @param {Array} vec2 - Second embedding vector
 * @returns {Number} - Similarity score (0-1)
 */
export const calculateSimilarity = (vec1, vec2) => {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    normA += vec1[i] * vec1[i];
    normB += vec2[i] * vec2[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  // Adjust similarity to 0-1 range
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return (similarity + 1) / 2;
};

/**
 * Project high-dimensional embedding to 2D for visualization
 * @param {Array} embedding - High-dimensional embedding vector
 * @returns {Array} - [x, y] coordinates
 */
export const projectToTwoDimensions = (embedding) => {
  if (!embedding || embedding.length === 0) {
    return [0, 0];
  }
  
  // Very simple dimensionality reduction
  // In production, you'd use t-SNE, UMAP, or PCA
  
  // Use the first few dimensions to influence x coordinate (include hash dims)
  const xCoord = embedding.slice(0, 10).reduce((sum, val, i) => {
      // Give slightly more weight to hash-derived dims? Or just include them.
      return sum + (val || 0) * (i + 1);
  }, 0);
  
  // Use the next few dimensions to influence y coordinate
  const yCoord = embedding.slice(10, 20).reduce((sum, val, i) => {
      return sum + (val || 0) * (i + 1);
  }, 0);

  // Log the intermediate values
  // console.log('projectToTwoDimensions - Input embedding (first 20 dims):', embedding.slice(0, 20));
  // console.log('projectToTwoDimensions - Calculated coords:', { xCoord, yCoord });

  // Return the raw projection coordinates
  // Normalization might be needed here depending on the embedding range,
  // but for now, let's return the direct sums.
  return [xCoord, yCoord];
};

/**
 * Get embedding coordinates for multiple documents
 * @param {Array} documents - Array of document objects 
 * @returns {Object} - Map of document IDs to [x, y] coordinates
 */
export const getEmbeddingCoordinates = (documents) => {
  const coordinates = {};
  
  documents.forEach(doc => {
    const embedding = generateEmbedding(doc);
    coordinates[doc.id] = projectToTwoDimensions(embedding);
  });
  
  return coordinates;
};

// Simple hash function (basic string hashing)
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}; 