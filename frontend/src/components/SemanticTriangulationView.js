import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { generateEmbedding, projectToTwoDimensions } from '../semantic/embeddingService';
import SemanticTessellation from '../semantic/SemanticTessellation';
import MissingDocumentFinder from './MissingDocumentFinder';

const SemanticTriangulationView = ({ documents = [], coordinates = null, onAnalyzePoint }) => {
  const svgRef = useRef(null);
  const [tessellation, setTessellation] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [selectedTriangle, setSelectedTriangle] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Prepare documents with embeddings
  useEffect(() => {
    // We no longer generate embeddings here
    // We receive documents and coordinates as props
    if (!documents || documents.length < 3 || !coordinates) {
      console.log("TriangulationView: Waiting for documents and coordinates...");
      setTessellation(null); // Reset tessellation if props are invalid
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    // Filter documents to only those that have coordinates provided
    const docsWithCoords = documents.filter(doc => coordinates[doc.id]);
    
    if (docsWithCoords.length < 3) {
        console.warn(`TriangulationView: Only ${docsWithCoords.length} documents have coordinates. Need 3.`);
        setTessellation(null);
        setLoading(false);
        return;
    }
    
    // Create and build tessellation using the provided coordinates
    // Pass both the filtered documents and the full coordinates map
    const newTessellation = new SemanticTessellation(docsWithCoords, coordinates);
    newTessellation.buildTriangulation(); // This now uses the coordinates passed to constructor
    setTessellation(newTessellation);
    setLoading(false);
  }, [documents, coordinates]); // Re-run if documents or coordinates change
  
  // Draw the visualization
  useEffect(() => {
    // Add coordinates check here as well
    if (loading || !svgRef.current || !tessellation || !tessellation.initialized || !coordinates) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    const width = 800;
    const height = 600;
    const padding = 50;
    
    // Get visualization data
    const { triangles, points } = tessellation.getVisualizationData();

    if (!points || points.length === 0) return;
    
    // Calculate data bounds and create scales
    const xExtent = d3.extent(points, d => d.x);
    const yExtent = d3.extent(points, d => d.y);
    
    // Add buffer to extents if they are the same (e.g., single point)
    if (xExtent[0] === xExtent[1]) xExtent[0] -= 1; xExtent[1] += 1;
    if (yExtent[0] === yExtent[1]) yExtent[0] -= 1; yExtent[1] += 1;
    
    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([padding, width - padding]);
    
    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([height - padding, padding]);

    // Create groups for different visual elements
    const trianglesGroup = svg.append("g").attr("class", "triangles");
    const pointsGroup = svg.append("g").attr("class", "points");
    const labelsGroup = svg.append("g").attr("class", "labels");
    const hoverGroup = svg.append("g").attr("class", "hover-info");
    
    // Draw triangles
    trianglesGroup.selectAll("path")
      .data(triangles)
      .join("path")
      .attr("d", d => {
        const pathData = d3.path();
        const vertices = d.vertices;

        // Apply scaling to vertices
        const p0 = { x: xScale(vertices[0].x), y: yScale(vertices[0].y) };
        const p1 = { x: xScale(vertices[1].x), y: yScale(vertices[1].y) };
        const p2 = { x: xScale(vertices[2].x), y: yScale(vertices[2].y) };

        // Check for invalid coordinates
        if (isNaN(p0.x) || isNaN(p0.y) || isNaN(p1.x) || isNaN(p1.y) || isNaN(p2.x) || isNaN(p2.y)) {
            return ""; // Return empty path if coords are bad
        }

        pathData.moveTo(p0.x, p0.y);
        pathData.lineTo(p1.x, p1.y);
        pathData.lineTo(p2.x, p2.y);
        pathData.closePath();

        const pathString = pathData.toString();
        return pathString;
      })
      .attr("fill", d => selectedTriangle && selectedTriangle.id === d.id ? "#e6f7ff" : "#f2f2f2")
      .attr("stroke", "#666")
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        setSelectedTriangle(d);
      });
      
    // Create a transparent overlay for each triangle to handle mouse events
    trianglesGroup.selectAll("path.interactive")
      .data(triangles)
      .join("path")
      .attr("class", "interactive")
      .attr("d", d => {
        const pathData = d3.path();
        const vertices = d.vertices;
        
        pathData.moveTo(xScale(vertices[0].x), yScale(vertices[0].y));
        pathData.lineTo(xScale(vertices[1].x), yScale(vertices[1].y));
        pathData.lineTo(xScale(vertices[2].x), yScale(vertices[2].y));
        pathData.closePath();
        
        return pathData.toString();
      })
      .attr("fill", "transparent")
      .attr("cursor", "crosshair")
      .on("mousemove", (event, d) => {
        const [mouseX, mouseY] = d3.pointer(event);
        setHoveredPoint([mouseX, mouseY]);
        
        // Invert scales to get data coordinates
        const dataX = xScale.invert(mouseX);
        const dataY = yScale.invert(mouseY);
        
        // Analyze the point in semantic space using DATA coordinates
        const analysis = tessellation.analyzePoint([dataX, dataY]);
        
        if (analysis) {
          // Display hover info
          hoverGroup.selectAll("*").remove();
          
          // Add small circle at hover point (SVG coords)
          hoverGroup.append("circle")
            .attr("cx", mouseX)
            .attr("cy", mouseY)
            .attr("r", 4)
            .attr("fill", "#ff6600");
            
          // Add line to each vertex with thickness based on weight
          analysis.triangle.vertices.forEach((doc, i) => {
            // Use scaled coordinates for drawing lines
            const scaledVertex = points.find(p => p.id === doc.id);
            if (!scaledVertex) return;
            const weight = analysis.weights[i];
            
            hoverGroup.append("line")
              .attr("x1", mouseX)
              .attr("y1", mouseY)
              .attr("x2", xScale(scaledVertex.x))
              .attr("y2", yScale(scaledVertex.y))
              .attr("stroke", "#666")
              .attr("stroke-width", weight * 3)
              .attr("stroke-opacity", 0.5);
          });
          
          // Add small tooltip with operation type (position based on SVG coords)
          hoverGroup.append("rect")
            .attr("x", mouseX + 10)
            .attr("y", mouseY - 10)
            .attr("width", 140)
            .attr("height", 24)
            .attr("fill", "white")
            .attr("stroke", "#666")
            .attr("rx", 4);
            
          hoverGroup.append("text")
            .attr("x", mouseX + 15)
            .attr("y", mouseY + 5)
            .attr("font-size", "12px")
            .text(analysis.semantics.setOperation.type);
        }
      })
      .on("mouseout", () => {
        setHoveredPoint(null);
        hoverGroup.selectAll("*").remove();
      })
      .on("click", (event, d) => {
        const [mouseX, mouseY] = d3.pointer(event);
        
        // Invert scales to get data coordinates
        const dataX = xScale.invert(mouseX);
        const dataY = yScale.invert(mouseY);
        
        // Analyze the point in semantic space using DATA coordinates
        const analysis = tessellation.analyzePoint([dataX, dataY]);
        
        if (analysis && onAnalyzePoint) {
          onAnalyzePoint(analysis);
        }
        
        setSelectedTriangle(d);
      });
      
    // Draw document points (using scaled coordinates)
    pointsGroup.selectAll("circle")
      .data(points)
      .join("circle")
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y))
      .attr("r", 7)
      .attr("fill", "#3366cc")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2);
      
    // Add document labels with better positioning and background for readability
    labelsGroup.selectAll("g")
      .data(points)
      .join("g")
      .attr("transform", d => `translate(${xScale(d.x)}, ${yScale(d.y) - 15})`)
      .call(g => {
        // Add background rect for better visibility
        g.append("rect")
          .attr("x", -60)
          .attr("y", -15)
          .attr("width", 120)
          .attr("height", 20)
          .attr("fill", "white")
          .attr("stroke", "#3366cc")
          .attr("stroke-width", 1.5)
          .attr("rx", 4)
          .attr("opacity", 0.9);
        
        // Add text label
        g.append("text")
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .attr("font-weight", "bold")
          .attr("dy", "0.35em")
          .text(d => d.title || d.id);
      });
      
    // Add title
    svg.append("text")
      .attr("x", 20)
      .attr("y", 30)
      .attr("font-size", "18px")
      .attr("font-weight", "bold")
      .text("Semantic Document Triangulation");
      
    // Add helper text (position is fixed relative to SVG)
    svg.append("text")
      .attr("x", width - 20)
      .attr("y", 30)
      .attr("text-anchor", "end")
      .attr("font-size", "14px")
      .attr("fill", "#666")
      .text("Click on triangle interiors to analyze semantic meaning");
      
  }, [tessellation, loading, selectedTriangle, hoveredPoint, onAnalyzePoint, coordinates]);
  
  // Display semantic details when a point is selected
  const renderSemanticDetails = () => {
    if (!selectedTriangle || !hoveredPoint || !tessellation) return null;
    
    const analysis = tessellation.analyzePoint(hoveredPoint);
    if (!analysis) return null;
    
    const { semantics, triangle } = analysis;
    
    return (
      <div className="semantic-details">
        <h3>Semantic Analysis</h3>
        <div className="operation-type">
          <strong>Operation Type:</strong> {semantics.setOperation.type}
        </div>
        <div className="description">
          {semantics.setOperation.description}
        </div>
        <div className="conceptual">
          <em>{semantics.setOperation.conceptual}</em>
        </div>
        
        <h4>Document Contributions</h4>
        <ul className="contributions">
          {semantics.contributions.map(contribution => (
            <li key={contribution.id}>
              <strong>{contribution.title}:</strong> {Math.round(contribution.weight * 100)}% 
              (Similarity: {Math.round(contribution.similarity * 100)}%)
            </li>
          ))}
        </ul>
        
        <MissingDocumentFinder
          semantics={semantics}
          allDocuments={documents}
          excludeDocIds={triangle.vertices.map(doc => doc.id)}
          onSearch={handleExternalSearch}
          onImport={handleImportDocument}
        />
      </div>
    );
  };
  
  // Handler for external search
  const handleExternalSearch = (query) => {
    // This could open a modal with search results or navigate to a search page
    console.log('Searching for:', query);
    // In a real implementation, you would make an API call or trigger a search
    // For example: props.onSearchDocuments(query);
    alert(`Searching for: ${query}\n\nIn a real implementation, this would execute a search for documents matching this query.`);
  };
  
  // Handler for importing a document to the current analysis
  const handleImportDocument = (document) => {
    // This would allow the document to be included in the current analysis
    console.log('Importing document:', document);
    // In a real implementation, you would update the document set
    // For example: props.onImportDocument(document);
    alert(`Document "${document.title}" would be imported into this analysis space.\n\nIn a real implementation, this document would be added to your working set.`);
  };
  
  return (
    <div className="semantic-triangulation-container">
      {loading ? (
        <div className="loading">Loading triangulation...</div>
      ) : documents.length < 3 ? (
        <div className="not-enough-docs">
          Need at least 3 documents to create triangulation
        </div>
      ) : !coordinates ? ( // Add a check for coordinates
        <div className="loading">Loading coordinates...</div>
      ) : (
        <>
          <svg 
            ref={svgRef} 
            width="800" 
            height="600" 
            style={{ border: "1px solid #ccc" }}
          />
          {renderSemanticDetails()}
        </>
      )}
    </div>
  );
};

export default SemanticTriangulationView; 