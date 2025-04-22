/**
 * SemanticTessellation class
 * Manages the triangulation of documents in semantic space
 */

import { Delaunay } from 'd3-delaunay';
import SemanticTriangle from './SemanticTriangle';
import { projectToTwoDimensions } from './embeddingService';

class SemanticTessellation {
  /**
   * Create a new semantic tessellation for a set of documents and their coordinates
   * @param {Array} documents - Array of document objects
   * @param {Object} coordinates - Object mapping document ID to [x, y] coordinates
   */
  constructor(documents = [], coordinates = null) {
    this.documents = documents;
    this.coordinates = coordinates; // Store coordinates
    this.triangles = [];
    this.delaunay = null;
    this.voronoi = null;
    this.pointToDocumentMap = new Map();
    this.initialized = false;
    this.useManualTriangulation = false;
  }

  /**
   * Build the triangulation from the document set
   * @returns {Object} - The semantic tessellation
   */
  buildTriangulation() {
    try {
      // Check for documents AND coordinates
      if (!this.documents || this.documents.length < 3 || !this.coordinates) {
        console.warn('Need at least 3 documents and their coordinates to build triangulation');
        this.initialized = false;
        return this;
      }

      console.log(`Building triangulation with ${this.documents.length} documents and provided coordinates`);

      // Validate documents and filter out those without coordinates
      const validDocuments = this.documents.filter(doc => 
        doc && doc.id && this.coordinates[doc.id]
      );
      
      if (validDocuments.length < 3) {
        console.warn(`Only ${validDocuments.length} valid documents with coordinates found, need at least 3`);
        this.initialized = false;
        return this;
      }
      
      // Use only valid documents
      this.documents = validDocuments;
      
      // Limit if needed (already done in Demo component, but keep as safety?)
      // if (this.documents.length > 10) { ... }

      // --- Use PRE-FETCHED coordinates --- 
      const points = [];
      this.pointToDocumentMap.clear();
      
      this.documents.forEach((doc) => {
        const point = this.coordinates[doc.id]; // Get coords from the stored object
        
        if (!point || point.length !== 2) {
            console.warn(`Invalid or missing coordinates for document ${doc.id}. Skipping.`);
            return; // Skip if coords are bad
        }

        // Keep a small random offset? Or rely on embedding variance?
        // Let's remove it for now, assuming real embeddings provide enough separation.
        // point[0] += (Math.random() - 0.5) * 0.01; 
        // point[1] += (Math.random() - 0.5) * 0.01;
        
        points.push(point); // points is now an array of [x, y] arrays
        // Map needs to handle the point array representation
        this.pointToDocumentMap.set(point.toString(), doc);
      });
      
      if (points.length < 3) {
           console.warn(`Only ${points.length} valid points generated. Need at least 3 for triangulation.`);
           this.initialized = false;
           return this;
      }

      // Decide on triangulation approach based on number of documents
      this.useManualTriangulation = this.documents.length <= 3;
      
      if (this.useManualTriangulation) {
        // For exactly 3 documents, create a single triangle
        this.triangles = [new SemanticTriangle(
          this.documents[0], 
          this.documents[1], 
          this.documents[2]
        )];
        console.log('Created manual triangulation with 1 triangle');
      } else {
        // Create Delaunay triangulation from the points array
        this.delaunay = Delaunay.from(points);
        
        // // Create Voronoi diagram (optional for visualization) - bounds might need adjustment
        // const width = 800; // Or calculate bounds from points
        // const height = 600;
        // this.voronoi = this.delaunay.voronoi([0, 0, width, height]); 
        
        // Create semantic triangles from the triangulation
        this.triangles = [];
        
        // Extract triangles from the Delaunay triangulation
        const { triangles: triangleIndices } = this.delaunay;
        
        for (let i = 0; i < triangleIndices.length; i += 3) {
          const docA = this.documents[triangleIndices[i]];
          const docB = this.documents[triangleIndices[i + 1]];
          const docC = this.documents[triangleIndices[i + 2]];
          
          if (docA && docB && docC && docA.id && docB.id && docC.id) {
            this.triangles.push(new SemanticTriangle(docA, docB, docC));
          }
        }
        
        console.log(`Built Delaunay triangulation with ${this.triangles.length} triangles`);
      }
      
      this.initialized = this.triangles.length > 0;
      if (!this.initialized) {
        console.warn('Failed to create any valid triangles');
      }
      
      return this;
    } catch (error) {
      console.error('Error building triangulation:', error);
      this.initialized = false;
      return this;
    }
  }

  /**
   * Find the triangle containing a given point
   * @param {Array} point - [x, y] coordinates
   * @returns {SemanticTriangle|null} - The triangle containing the point or null
   */
  findContainingTriangle(point) {
    if (!this.initialized) {
      return null;
    }
    
    if (this.useManualTriangulation) {
      // With manual triangulation, just check if the point is inside the single triangle
      const triangle = this.triangles[0];
      if (!triangle) return null;
      
      const vertices = triangle.vertices.map(doc => this.coordinates[doc.id]).filter(Boolean);
      if(vertices.length !== 3) return null; // Ensure we got 3 valid coords

      // const isInside = pointInTriangle(point, vertices[0], vertices[1], vertices[2]);
      // Use Delaunay find even for 3 points if available, might be more robust
      if (this.delaunay) {
         // Let Delaunay handle finding, even for 3 points (if it was created)
      } else {
          // Fallback to manual check if Delaunay wasn't built (shouldn't happen with current logic)
          console.warn("Manual triangle check - Delaunay object missing unexpectedly");
          return null; 
      }
    }
    
    // Otherwise use Delaunay for more complex triangulations
    if (!this.delaunay) {
      return null;
    }
    
    const triangleIndex = this.delaunay.find(point[0], point[1]);
    if (triangleIndex === -1) {
      return null;
    }
    
    // Find the corresponding semantic triangle
    // The triangleIndex is the starting index in the triangles array
    const docIndices = [
      this.delaunay.triangles[triangleIndex * 3],
      this.delaunay.triangles[triangleIndex * 3 + 1],
      this.delaunay.triangles[triangleIndex * 3 + 2]
    ];
    
    // Find the matching triangle based on the document indices
    // Make sure to handle potentially undefined documents
    return this.triangles.find(triangle => {
      const triangleDocs = triangle.vertices;
      return docIndices.every(idx => {
        // Guard against undefined documents
        const doc = this.documents[idx];
        if (!doc || !doc.id) return false;
        
        // Check if this document matches any vertex in the triangle
        return triangleDocs.some(triangleDoc => 
          triangleDoc && triangleDoc.id && triangleDoc.id === doc.id
        );
      });
    });
  }

  /**
   * Analyze a point within the tessellation
   * @param {Array} point - [x, y] coordinates to analyze
   * @returns {Object|null} - Analysis results or null if outside all triangles
   */
  analyzePoint(point) {
    if (!point || !this.initialized) {
      return null;
    }
    
    try {
      const triangle = this.findContainingTriangle(point);
      if (!triangle) {
        // console.log('No triangle found containing point:', point); // Reduce noise
        return null;
      }
      
      // Get the coordinates of the triangle vertices directly from stored coordinates
      const vertices = triangle.vertices.map(doc => this.coordinates[doc.id]).filter(Boolean);
      if (!vertices || vertices.length !== 3) {
        console.warn('Invalid vertices coordinates for triangle', triangle.id);
        return null;
      }
      
      // Calculate barycentric coordinates of the point in the triangle
      const weights = triangle.calculateBarycentricCoordinates(point, vertices);
      if (!weights || weights.length !== 3) {
        console.warn('Invalid weights calculated for point', point);
        return null;
      }
      
      // Get semantic interpretation
      const semantics = triangle.getInteriorPointSemantics(weights);
      
      return {
        triangle,
        weights,
        semantics,
        point
      };
    } catch (error) {
      console.error('Error analyzing point:', error);
      return null;
    }
  }

  /**
   * Get the visualization data for the tessellation
   * @returns {Object} - Data for visualizing the tessellation
   */
  getVisualizationData() {
    if (!this.initialized) {
      console.warn('Cannot get visualization data: tessellation not initialized');
      return { 
        triangles: [], 
        points: [], 
        documents: []
      };
    }
    
    // Map documents to points using the stored coordinates
    const pointsData = this.documents.map(doc => {
      const coords = this.coordinates[doc.id];
      // Handle cases where coords might be missing for a doc (should be filtered earlier)
      if (!coords) return null; 
      return {
        id: doc.id,
        title: doc.title || doc.id,
        x: coords[0],
        y: coords[1]
      };
    }).filter(Boolean); // Remove nulls if any coords were missing
    
    const triangleData = this.triangles.map(triangle => {
      // Map vertex document IDs to their coordinates
      const vertices = triangle.vertices.map(doc => {
         const coords = this.coordinates[doc.id];
         return coords ? { x: coords[0], y: coords[1], docId: doc.id } : null;
      }).filter(Boolean); // Filter out any vertices whose coords were missing
      
      // Only include triangles where all 3 vertices had valid coordinates
      if (vertices.length !== 3) return null;
      
      return {
        id: triangle.id,
        vertices: vertices,
        documentIds: triangle.vertices.map(doc => doc.id)
      };
    }).filter(Boolean); // Filter out null triangles
    
    return {
      triangles: triangleData,
      points: pointsData, // Use the points derived from coordinates
      documents: this.documents.map(doc => ({
        id: doc.id,
        title: doc.title || doc.id
      }))
    };
  }
}

/**
 * Checks if a point is inside a triangle using barycentric coordinates
 * @param {Array} p - The point to check [x,y]
 * @param {Array} a - First vertex of triangle [x,y]
 * @param {Array} b - Second vertex of triangle [x,y]
 * @param {Array} c - Third vertex of triangle [x,y]
 * @returns {boolean} - True if point is inside triangle
 */
function pointInTriangle(p, a, b, c) {
  // Compute barycentric coordinates
  const area = 0.5 * (-b[1] * c[0] + a[1] * (-b[0] + c[0]) + a[0] * (b[1] - c[1]) + b[0] * c[1]);
  const s = 1 / (2 * area) * (a[1] * c[0] - a[0] * c[1] + (c[1] - a[1]) * p[0] + (a[0] - c[0]) * p[1]);
  const t = 1 / (2 * area) * (a[0] * b[1] - a[1] * b[0] + (a[1] - b[1]) * p[0] + (b[0] - a[0]) * p[1]);
  
  // Check if point is inside triangle
  return s >= 0 && t >= 0 && 1 - s - t >= 0;
}

export default SemanticTessellation; 