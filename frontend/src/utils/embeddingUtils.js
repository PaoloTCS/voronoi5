/**
 * Utilities for working with semantic embeddings
 */

import * as d3 from 'd3';

/**
 * Calculates cosine similarity between two vectors
 * @param {Array} vec1 - First vector
 * @param {Array} vec2 - Second vector
 * @returns {Number} Cosine similarity (-1 to 1)
 */
export const cosineSimilarity = (vec1, vec2) => {
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
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  };
  
// Semantic relations between domains - this will be improved in future versions
// with real semantic embeddings from an API
const SEMANTIC_RELATIONS = {
  // Art related domains
  'art': ['music', 'literature', 'photography', 'design', 'architecture'],
  'music': ['art', 'acoustics', 'composition', 'rhythm'],
  'literature': ['art', 'philosophy', 'history', 'writing'],
  'photography': ['art', 'physics', 'design', 'optics'],
  
  // Science related domains
  'physics': ['mathematics', 'chemistry', 'astronomy', 'engineering', 'optics', 'acoustics'],
  'mathematics': ['physics', 'statistics', 'computer science', 'logic', 'geometry'],
  'chemistry': ['physics', 'biology', 'medicine', 'materials'],
  'biology': ['chemistry', 'medicine', 'ecology', 'genetics'],
  
  // Humanities
  'history': ['philosophy', 'politics', 'literature', 'archaeology', 'sociology'],
  'philosophy': ['history', 'ethics', 'logic', 'religion', 'literature'],
  'sociology': ['history', 'psychology', 'politics', 'anthropology'],
  
  // Other
  'computer science': ['mathematics', 'engineering', 'data science', 'ai'],
  'religion': ['philosophy', 'history', 'ethics', 'spirituality'],
  'business': ['economics', 'marketing', 'finance', 'management'],
};

// Get related domains from our semantic relations map
// Returns empty array if no relations found
const getRelatedDomains = (domain) => {
  const normalizedDomain = domain.toLowerCase();
  return SEMANTIC_RELATIONS[normalizedDomain] || [];
};

// Calculate relationship strength between two domains (0-1)
export const getRelationshipStrength = (domain1, domain2) => {
  const related1 = getRelatedDomains(domain1);
  const related2 = getRelatedDomains(domain2);
  
  // Check direct relationships
  if (related1.includes(domain2.toLowerCase())) return 0.8;
  if (related2.includes(domain1.toLowerCase())) return 0.8;
  
  // Check shared relationships (second-degree connections)
  const commonRelations = related1.filter(rel => related2.includes(rel));
  if (commonRelations.length > 0) {
    return 0.4 + (Math.min(commonRelations.length, 3) * 0.1); // 0.5-0.7 based on number of shared connections
  }
  
  return 0.1; // Default low relationship strength
};

// Create deterministic initial positions based on domain name
const getInitialPosition = (domain, width, height, padding) => {
  // Use a simple hash function to get deterministic values from the domain name
  const hash = domain.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  
  // Use the hash to generate deterministic x,y coordinates
  const angle = Math.abs(hash) % 360 * (Math.PI / 180);
  const radius = (Math.min(width, height) / 2) - padding;
  
  return [
    (width / 2) + radius * Math.cos(angle),
    (height / 2) + radius * Math.sin(angle)
  ];
};

// Create mock embeddings using force-directed layout for semantic clustering
export const createMockEmbeddingCoordinates = (domains) => {
  if (!domains || domains.length === 0) return {};
  
  const width = 900;
  const height = 600;
  const padding = 80;
  
  const coordinates = {};
  
  // Initialize with deterministic positions
  domains.forEach(domain => {
    coordinates[domain] = getInitialPosition(domain, width, height, padding);
  });
  
  // If only a few domains, just use the initial positions
  if (domains.length <= 3) {
    return coordinates;
  }
  
  // For more domains, use force-directed layout to position related domains closer
  const nodes = domains.map(domain => ({ 
    id: domain,
    x: coordinates[domain][0],
    y: coordinates[domain][1]
  }));
  
  // Create links between related domains with strength based on semantic relationship
  const links = [];
  for (let i = 0; i < domains.length; i++) {
    for (let j = i + 1; j < domains.length; j++) {
      const domain1 = domains[i];
      const domain2 = domains[j];
      const strength = getRelationshipStrength(domain1, domain2);
      
      if (strength > 0.1) { // Only create links for meaningful relationships
        links.push({
          source: domain1,
          target: domain2,
          strength
        });
      }
    }
  }
  
  // Run the simulation with convergence check
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links)
      .id(d => d.id)
      .distance(link => 200 * (1 - link.strength))
      .strength(link => link.strength))
    .force("charge", d3.forceManyBody()
      .strength(-300)
      .distanceMax(300)) // Limit the range of repulsion
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(60))
    .force("x", d3.forceX(width / 2).strength(0.05))
    .force("y", d3.forceY(height / 2).strength(0.05));
  
  // Run the simulation with convergence check
  let iterations = 0;
  const maxIterations = 300;
  const minAlpha = 0.01;
  
  simulation.stop();
  
  while (iterations < maxIterations) {
    simulation.tick();
    iterations++;
    
    // Check for convergence
    if (simulation.alpha() < minAlpha) {
      break;
    }
  }
  
  // Convert back to coordinates object with boundary enforcement
  nodes.forEach(node => {
    // Ensure nodes stay within boundaries with padding
    node.x = Math.max(padding, Math.min(width - padding, node.x));
    node.y = Math.max(padding, Math.min(height - padding, node.y));
    
    coordinates[node.id] = [node.x, node.y];
  });
  
  return coordinates;
};

// Adjust positions to avoid overlaps - can be used if needed
export const avoidOverlaps = (coordinates) => {
  // Only needed for many domains, simple scenarios handle this well already
  return coordinates;
};