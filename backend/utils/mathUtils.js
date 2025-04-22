/**
 * Calculates the cosine similarity between two vectors.
 * @param {number[]} vecA - The first vector.
 * @param {number[]} vecB - The second vector.
 * @returns {number} The cosine similarity.
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    throw new Error("Invalid input vectors for cosine similarity.");
  }

  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    // Handle zero vectors - similarity is typically considered 0 or undefined.
    // Returning 0 is often practical.
    return 0.0; 
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculates the cosine distance between two vectors.
 * Cosine distance = 1 - cosine similarity. Ranges from 0 (identical) to 2 (opposite).
 * @param {number[]} vecA - The first vector.
 * @param {number[]} vecB - The second vector.
 * @returns {number} The cosine distance.
 */
function cosineDistance(vecA, vecB) {
  return 1 - cosineSimilarity(vecA, vecB);
}

module.exports = { cosineSimilarity, cosineDistance }; 