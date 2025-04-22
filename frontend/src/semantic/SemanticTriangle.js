/**
 * SemanticTriangle class
 * Represents a triangle in semantic space with document vertices
 * Provides methods for analyzing interior points
 */

import { calculateSimilarity, generateEmbedding } from './embeddingService';

class SemanticTriangle {
  /**
   * Create a new semantic triangle with document vertices
   * @param {Object} docA - First document vertex
   * @param {Object} docB - Second document vertex
   * @param {Object} docC - Third document vertex
   */
  constructor(docA, docB, docC) {
    // Validate input documents
    if (!docA || !docB || !docC || !docA.id || !docB.id || !docC.id) {
      console.error('Cannot create triangle: invalid documents provided');
      throw new Error('Invalid documents for triangle creation');
    }
    
    this.vertices = [docA, docB, docC];
    this.embeddings = this.vertices.map(doc => doc.embedding || generateEmbedding(doc));
    this.id = `triangle-${docA.id}-${docB.id}-${docC.id}`;
  }

  /**
   * Get the 2D coordinates of the triangle vertices
   * @param {Function} projectionFn - Function to project embeddings to 2D
   * @returns {Array} - Array of [x, y] coordinates for each vertex
   */
  getCoordinates(projectionFn) {
    return this.embeddings.map(embedding => projectionFn(embedding));
  }

  /**
   * Calculate barycentric coordinates for a point inside the triangle
   * @param {Array} point - [x, y] coordinates of the point
   * @param {Array} vertices - Array of [x, y] vertex coordinates
   * @returns {Array} - Barycentric weights [w1, w2, w3]
   */
  calculateBarycentricCoordinates(point, vertices) {
    // Validate inputs
    if (!point || !vertices || vertices.length !== 3) {
      console.error('Invalid inputs for barycentric coordinate calculation');
      return [0.33, 0.33, 0.34]; // Default to equal weights
    }
    
    try {
      // Extract vertices
      const [v1, v2, v3] = vertices;
      
      // Calculate vectors and determinant
      const denominator = ((v2[1] - v3[1]) * (v1[0] - v3[0]) + (v3[0] - v2[0]) * (v1[1] - v3[1]));
      
      // Handle degenerate triangles
      if (Math.abs(denominator) < 0.0001) {
        console.warn('Degenerate triangle detected in barycentric calculation');
        return [0.33, 0.33, 0.34]; // Default to equal weights
      }
      
      // Calculate barycentric coordinates
      const w1 = ((v2[1] - v3[1]) * (point[0] - v3[0]) + (v3[0] - v2[0]) * (point[1] - v3[1])) / denominator;
      const w2 = ((v3[1] - v1[1]) * (point[0] - v3[0]) + (v1[0] - v3[0]) * (point[1] - v3[1])) / denominator;
      const w3 = 1 - w1 - w2;
      
      return [w1, w2, w3];
    } catch (error) {
      console.error('Error calculating barycentric coordinates:', error);
      return [0.33, 0.33, 0.34]; // Default to equal weights
    }
  }

  /**
   * Check if a point is inside the triangle
   * @param {Array} point - [x, y] coordinates of the point
   * @param {Array} vertices - Array of [x, y] vertex coordinates
   * @returns {Boolean} - True if point is inside
   */
  isPointInside(point, vertices) {
    const [w1, w2, w3] = this.calculateBarycentricCoordinates(point, vertices);
    // Point is inside if all weights are ≥ 0 and ≤ 1
    return w1 >= 0 && w2 >= 0 && w3 >= 0 && w1 <= 1 && w2 <= 1 && w3 <= 1;
  }

  /**
   * Get the semantic meaning of an interior point based on barycentric weights
   * @param {Array} weights - Barycentric weights [w1, w2, w3]
   * @returns {Object} - Semantic interpretation data
   */
  getInteriorPointSemantics(weights) {
    try {
      // Validate weights
      if (!weights || weights.length !== 3 || !this.embeddings || this.embeddings.length !== 3) {
        console.warn('Invalid inputs for semantic analysis');
        return {
          contributions: this.vertices.map((doc, i) => ({
            id: doc?.id || `unknown-${i}`,
            title: doc?.title || doc?.id || `Unknown Document ${i}`,
            weight: 1/3,
            similarity: 0.5
          })),
          combinedEmbedding: [],
          setOperation: {
            type: 'unknown',
            description: 'Could not determine semantic relationship',
            conceptual: 'Analysis failed due to invalid data'
          }
        };
      }
      
      // Normalize weights to sum to 1
      const sum = weights.reduce((acc, w) => acc + w, 0);
      if (Math.abs(sum) < 0.0001) {
        console.warn('Invalid weights with zero sum');
        return {
          contributions: this.vertices.map((doc, i) => ({
            id: doc?.id || `unknown-${i}`,
            title: doc?.title || doc?.id || `Unknown Document ${i}`,
            weight: 1/3,
            similarity: 0.5
          })),
          combinedEmbedding: [],
          setOperation: {
            type: 'unknown',
            description: 'Could not determine semantic relationship',
            conceptual: 'Analysis failed due to invalid weights'
          }
        };
      }
      
      const normalizedWeights = weights.map(w => w / sum);
      
      // Verify all embeddings have the same dimensions
      const embeddingLength = this.embeddings[0]?.length || 0;
      if (embeddingLength === 0 || this.embeddings.some(e => !e || e.length !== embeddingLength)) {
        console.warn('Inconsistent embedding dimensions');
        return {
          contributions: this.vertices.map((doc, i) => ({
            id: doc?.id || `unknown-${i}`,
            title: doc?.title || doc?.id || `Unknown Document ${i}`,
            weight: normalizedWeights[i],
            similarity: 0.5
          })),
          combinedEmbedding: [],
          setOperation: {
            type: 'unknown',
            description: 'Could not determine semantic relationship',
            conceptual: 'Analysis failed due to inconsistent embedding dimensions'
          }
        };
      }
      
      // Compute weighted combination of document embeddings
      const combinedEmbedding = Array(embeddingLength).fill(0);
      
      for (let i = 0; i < this.embeddings.length; i++) {
        for (let j = 0; j < combinedEmbedding.length; j++) {
          combinedEmbedding[j] += normalizedWeights[i] * this.embeddings[i][j];
        }
      }
      
      // Analyze the weights to determine set operations
      const setOperation = this.interpretAsSetOperations(normalizedWeights);
      
      // Calculate similarity of combined embedding to each vertex
      const similarities = this.embeddings.map(embedding => 
        calculateSimilarity(combinedEmbedding, embedding)
      );
      
      return {
        // Document contributions with names and IDs
        contributions: this.vertices.map((doc, i) => ({
          id: doc?.id || `unknown-${i}`,
          title: doc?.title || doc?.id || `Unknown Document ${i}`,
          weight: normalizedWeights[i],
          similarity: similarities[i]
        })),
        combinedEmbedding,
        setOperation
      };
    } catch (error) {
      console.error('Error calculating interior point semantics:', error);
      return {
        contributions: this.vertices.map((doc, i) => ({
          id: doc?.id || `unknown-${i}`,
          title: doc?.title || doc?.id || `Unknown Document ${i}`,
          weight: 1/3,
          similarity: 0.5
        })),
        combinedEmbedding: [],
        setOperation: {
          type: 'error',
          description: 'Error analyzing semantic relationship',
          conceptual: 'Analysis failed due to an error'
        }
      };
    }
  }

  /**
   * Interpret weights as set operations on document features
   * @param {Array} weights - Normalized barycentric weights [w1, w2, w3]
   * @returns {Object} - Set operation interpretation
   */
  interpretAsSetOperations(weights) {
    // Define thresholds for interpretation
    const HIGH = 0.6;
    const MEDIUM = 0.3;
    const LOW = 0.1;
    
    // Get document titles for better output
    const titles = this.vertices.map(doc => doc.title || doc.id);
    
    // Check for balanced intersection (all weights similar)
    if (weights.every(w => w >= LOW && w <= HIGH) && 
        Math.max(...weights) - Math.min(...weights) < 0.3) {
      return {
        type: 'balanced_intersection',
        description: `Balanced intersection of all three documents: ${titles.join(', ')}`,
        conceptual: 'This point represents concepts that appear in all three documents with similar importance.'
      };
    }
    
    // Check for dominant document with influence
    const maxIndex = weights.indexOf(Math.max(...weights));
    if (weights[maxIndex] >= HIGH) {
      // Other significant contributors?
      const otherIndices = weights
        .map((w, i) => i !== maxIndex && w >= LOW ? i : -1)
        .filter(i => i !== -1);
        
      if (otherIndices.length === 0) {
        return {
          type: 'single_document',
          description: `Primarily ${titles[maxIndex]} concepts`,
          conceptual: 'This point closely resembles a single document with minimal influence from others.'
        };
      } else {
        const otherTitles = otherIndices.map(i => titles[i]);
        return {
          type: 'dominant_with_influence',
          description: `${titles[maxIndex]} with influence from ${otherTitles.join(' and ')}`,
          conceptual: 'This point represents a dominant document modified by specific features from others.'
        };
      }
    }
    
    // Check for paired intersection with little third influence
    const sortedIndices = weights
      .map((w, i) => ({ weight: w, index: i }))
      .sort((a, b) => b.weight - a.weight);
    
    if (sortedIndices[0].weight >= MEDIUM && 
        sortedIndices[1].weight >= MEDIUM && 
        sortedIndices[2].weight < LOW) {
      const i1 = sortedIndices[0].index;
      const i2 = sortedIndices[1].index;
      return {
        type: 'paired_intersection',
        description: `Intersection of ${titles[i1]} and ${titles[i2]}`,
        conceptual: 'This point represents concepts shared between two documents with little influence from the third.'
      };
    }
    
    // Default case - weighted combination
    return {
      type: 'complex_weighted_combination',
      description: `Complex combination of all documents`,
      conceptual: 'This point represents a nuanced mix of concepts from all three documents in varying degrees.'
    };
  }
}

export default SemanticTriangle; 