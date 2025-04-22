// ~/VerbumTechnologies/voronoi1/backend/controllers/embeddingController.js
const dimensionReduction = require('../utils/dimensionReduction');

exports.getEmbeddings = async (req, res) => {
  try {
    const { domains } = req.body;
    
    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ error: 'Invalid domains' });
    }
    
    // Mock embeddings for development
    // This simulates semantic similarity without requiring an API
    const mockEmbeddings = {};
    
    // Create mock semantic vectors (these would normally come from a language model)
    const mockVectors = domains.map(domain => {
      // Different domains get different characteristic vectors
      if (domain.toLowerCase().includes('math') || domain.toLowerCase().includes('physics')) {
        // Science-related domains have similar vectors
        return [Math.random() * 0.5, Math.random() * 0.5, 0.8 + Math.random() * 0.2];
      } else if (domain.toLowerCase().includes('art') || domain.toLowerCase().includes('history')) {
        // Humanities domains have similar vectors
        return [0.8 + Math.random() * 0.2, Math.random() * 0.5, Math.random() * 0.5];
      } else if (domain.toLowerCase().includes('cat') || domain.toLowerCase().includes('dog')) {
        // Animal domains have similar vectors
        return [Math.random() * 0.5, 0.8 + Math.random() * 0.2, Math.random() * 0.5];
      } else {
        // Random vectors for other domains
        return [Math.random(), Math.random(), Math.random()];
      }
    });
    
    // Get 2D coordinates using simple projection (UMAP simulation)
    const coordinates = dimensionReduction.simplifyTo2D(mockVectors);
    
    // Scale coordinates to fit in the SVG viewport
    const padding = 50;
    const width = 900 - (2 * padding);
    const height = 600 - (2 * padding);
    
    // Find min/max values for normalization
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    coordinates.forEach(coord => {
      minX = Math.min(minX, coord[0]);
      maxX = Math.max(maxX, coord[0]);
      minY = Math.min(minY, coord[1]);
      maxY = Math.max(maxY, coord[1]);
    });
    
    // Normalize and scale coordinates
    const scaledCoordinates = coordinates.map(coord => [
      ((coord[0] - minX) / (maxX - minX || 1)) * width + padding,
      ((coord[1] - minY) / (maxY - minY || 1)) * height + padding
    ]);
    
    // Map domains to coordinates
    domains.forEach((domain, i) => {
      mockEmbeddings[domain] = scaledCoordinates[i];
    });
    
    res.json({ embeddings: mockEmbeddings });
  } catch (error) {
    console.error('Error calculating embeddings:', error);
    res.status(500).json({ error: 'Error calculating embeddings' });
  }
};