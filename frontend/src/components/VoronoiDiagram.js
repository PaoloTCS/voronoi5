// frontend/src/components/VoronoiDiagram.js
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Delaunay } from 'd3-delaunay';
import api from '../utils/api';
import { createMockEmbeddingCoordinates, avoidOverlaps, getRelationshipStrength } from '../utils/embeddingUtils';
import LoadingIndicator from './LoadingIndicator';

const VoronoiDiagram = ({ 
  domains = [],
  onDomainSelect, 
  currentPath = [] 
}) => {
  const svgRef = useRef(null);
  const [embeddingCoordinates, setEmbeddingCoordinates] = useState({});
  const [loading, setLoading] = useState(true);
  const [hoveredDomain, setHoveredDomain] = useState(null);
  
  // Current depth level (0-based)
  const currentLevel = currentPath.length;
  
  // Calculate semantic embeddings and 2D coordinates for domains
  useEffect(() => {
    if (!Array.isArray(domains) || domains.length === 0) {
      setLoading(false);
      setEmbeddingCoordinates({});
      return;
    }
    
    const fetchEmbeddings = async () => {
      setLoading(true);
      try {
        // In production, use the real API
        // const response = await api.getEmbeddings(domains);
        // setEmbeddingCoordinates(response.embeddings);
        
        // For development without a backend, create force-directed layout
        const mockEmbeddings = createMockEmbeddingCoordinates(domains);
        
        setEmbeddingCoordinates(mockEmbeddings);
      } catch (error) {
        console.error("Error fetching embeddings:", error);
        // Fallback to random positions
        const mockEmbeddings = {};
        domains.forEach(domain => {
          mockEmbeddings[domain] = [
            Math.random() * 800 + 50,
            Math.random() * 500 + 50
          ];
        });
        setEmbeddingCoordinates(mockEmbeddings);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEmbeddings();
  }, [domains]);
  
  // Draw the Voronoi diagram
  useEffect(() => {
    if (loading || !svgRef.current || !Array.isArray(domains) || domains.length === 0 || Object.keys(embeddingCoordinates).length === 0) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    const width = 900;
    const height = 600;
    
    // Create a group for the relationship lines
    const linesGroup = svg.append("g").attr("class", "relationships");
    
    // Create a group for the cells
    const cellsGroup = svg.append("g").attr("class", "cells");
    
    // Create a group for the labels
    const labelsGroup = svg.append("g").attr("class", "labels");
    
    // Extract points and create a points array
    const points = domains.map(domain => embeddingCoordinates[domain] || [width/2, height/2]);
    
    // Generate color scheme based on current level
    let colorScale;
    
    switch (currentLevel % 4) {
      case 0: // Root level - blues
        colorScale = d3.scaleSequential(d3.interpolateBlues)
          .domain([0, Math.max(domains.length, 1)]);
        break;
      case 1: // Level 1 - greens
        colorScale = d3.scaleSequential(d3.interpolateGreens)
          .domain([0, Math.max(domains.length, 1)]);
        break;
      case 2: // Level 2 - purples
        colorScale = d3.scaleSequential(d3.interpolatePurples)
          .domain([0, Math.max(domains.length, 1)]);
        break;
      case 3: // Level 3 - oranges
        colorScale = d3.scaleSequential(d3.interpolateOranges)
          .domain([0, Math.max(domains.length, 1)]);
        break;
      default:
        colorScale = d3.scaleSequential(d3.interpolateBlues)
          .domain([0, Math.max(domains.length, 1)]);
    }
    
    // Add relationship lines if we have enough domains and a hovered domain
    if (domains.length >= 2 && hoveredDomain) {
      const hoveredIndex = domains.indexOf(hoveredDomain);
      const hoveredPoint = points[hoveredIndex];
      
      domains.forEach((domain, i) => {
        if (domain !== hoveredDomain) {
          const strength = getRelationshipStrength(hoveredDomain, domain);
          const point = points[i];
          
          if (strength > 0.1) { // Only show significant relationships
            linesGroup.append("line")
              .attr("x1", hoveredPoint[0])
              .attr("y1", hoveredPoint[1])
              .attr("x2", point[0])
              .attr("y2", point[1])
              .attr("stroke", "#333")
              .attr("stroke-width", strength * 5) // Thicker lines for stronger relationships
              .attr("stroke-opacity", strength)
              .attr("stroke-dasharray", strength < 0.5 ? "3,3" : "none"); // Dashed for weak relationships
              
            // Add relationship label for stronger relationships
            if (strength >= 0.5) {
              const midX = (hoveredPoint[0] + point[0]) / 2;
              const midY = (hoveredPoint[1] + point[1]) / 2;
              
              labelsGroup.append("text")
                .attr("x", midX)
                .attr("y", midY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("fill", "#333")
                .attr("font-size", "12px")
                .attr("font-weight", "bold")
                .attr("background", "white")
                .text(`${Math.round(strength * 100)}%`);
            }
          }
        }
      });
    }
    
    // Check if we have enough points for Delaunay triangulation (need at least 3)
    const needsDelaunay = points.length >= 3;
    
    if (needsDelaunay) {
      // Create the Delaunay triangulation and Voronoi diagram
      const delaunay = Delaunay.from(points);
      const voronoi = delaunay.voronoi([0, 0, width, height]);
      
      // Draw the cells with level-appropriate colors
      cellsGroup.selectAll("path")
        .data(domains)
        .enter()
        .append("path")
        .attr("d", (_, i) => voronoi.renderCell(i))
        .attr("fill", (_, i) => colorScale(i))
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .on("mouseenter", (event, domain) => {
          setHoveredDomain(domain);
        })
        .on("mouseleave", () => {
          setHoveredDomain(null);
        })
        .on("click", (event, domain) => {
          onDomainSelect(domain);
        });
    } else {
      // Not enough points for Voronoi, draw simple circles instead
      cellsGroup.selectAll("circle")
        .data(domains)
        .enter()
        .append("circle")
        .attr("cx", (domain, i) => points[i][0])
        .attr("cy", (domain, i) => points[i][1])
        .attr("r", 50)
        .attr("fill", (_, i) => colorScale(i))
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .on("mouseenter", (event, domain) => {
          setHoveredDomain(domain);
        })
        .on("mouseleave", () => {
          setHoveredDomain(null);
        })
        .on("click", (event, domain) => {
          onDomainSelect(domain);
        });
    }
    
    // Add domain labels
    labelsGroup.selectAll("text.label")
      .data(domains)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", (domain, i) => points[i][0])
      .attr("y", (domain, i) => points[i][1])
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text(domain => domain)
      .attr("fill", (_, i) => {
        // Calculate brightness of the background and use contrasting text color
        const color = d3.color(colorScale(i));
        const brightness = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
        return brightness > 125 ? "#000" : "#fff";
      })
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .style("pointer-events", "none");
    
    // Add level indicator
    svg.append("text")
      .attr("x", 20)
      .attr("y", 30)
      .attr("fill", "#333")
      .attr("font-size", "18px")
      .attr("font-weight", "bold")
      .text(`Level ${currentLevel}: ${
        currentLevel === 0 
          ? "Root Domains" 
          : `Subdomains of "${Array.isArray(currentPath) && currentPath.length > 0 ? currentPath[currentPath.length - 1] : 'Unknown'}"`
      }`);
      
    // Add relationship hint if there are multiple domains
    if (domains.length >= 2) {
      svg.append("text")
        .attr("x", width - 20)
        .attr("y", 30)
        .attr("fill", "#666")
        .attr("font-size", "14px")
        .attr("text-anchor", "end")
        .text("Hover over a domain to see relationships");
    }
    
    // If there's only one or two domains, add help text
    if (domains.length < 3) {
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 40)
        .attr("text-anchor", "middle")
        .attr("fill", "#666")
        .attr("font-size", "14px")
        .text("Add more subdomains to enable Voronoi visualization");
    }
      
  }, [loading, embeddingCoordinates, domains, onDomainSelect, currentLevel, currentPath, hoveredDomain]);
  
  return (
    <div className="voronoi-container">
      {loading ? (
        <div className="loading">
          <div className="loading-spinner"></div>
          <div className="loading-text">Calculating semantic positions...</div>
        </div>
      ) : domains.length === 0 ? (
        <div className="empty-state">
          <div className="empty-message">
            <h3>No domains found</h3>
            <p>Use the panel on the right to add some domains</p>
          </div>
        </div>
      ) : (
        <svg ref={svgRef} width="900" height="600"></svg>
      )}
      
      <style jsx="true">{`
        .voronoi-container {
          position: relative;
          flex: 3;
          min-height: 600px;
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          background-color: #f9f9f9;
        }
        
        .voronoi-container svg {
          width: 100%;
          height: 100%;
        }
        
        .loading {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.8);
        }
        
        .loading-spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border-left-color: #3498db;
          animation: spin 1s linear infinite;
          margin-bottom: 15px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-text {
          color: #333;
          font-weight: 500;
        }
        
        .empty-state {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        
        .empty-message {
          color: #666;
        }
        
        .empty-message h3 {
          margin-bottom: 10px;
          color: #333;
        }
      `}</style>
    </div>
  );
};

export default VoronoiDiagram;