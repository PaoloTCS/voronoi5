import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Document from '../models/Document';
import SemanticTriangulationView from './SemanticTriangulationView';
import { useDomains } from '../context/DomainContext';

const SemanticTriangulationDemo = () => {
  const [documents, setDocuments] = useState([]);
  const [coordinates, setCoordinates] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [useSampleDocs, setUseSampleDocs] = useState(false);
  const [error, setError] = useState(null);
  
  // Get location to check if we have path params
  const location = useLocation();
  
  // Get domain context for accessing user documents
  const {
    getCurrentDocuments,
    getPathString,
    externalPapers,
    currentPath,
    allDocuments,
    selectedItems,
    allDomains
  } = useDomains();
  
  // Load documents and fetch coordinates on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      setDocuments([]);
      setCoordinates(null);

      let docsToEmbed = [];

      try {
        // --- Check if currentPath from context is available ---
        if (!currentPath) {
          setError("Current domain path is not available. Please navigate to a domain.");
          setLoading(false);
          return;
        }

        // --- Use selectedItems from context instead of localStorage ---
        console.log("TriangulationDemo: Checking selected items from context:", selectedItems);

        if (selectedItems && selectedItems.length >= 3) {
          console.log(`TriangulationDemo: Using ${selectedItems.length} selected documents from context for path:`, currentPath.join('/'));
          // Limit to max 10 docs, but use all selected if fewer
          docsToEmbed = selectedItems.slice(0, 10).map(item => {
            const content = item.content || `Placeholder content for ${item.name || item.title}`;
            return {
              id: item.id,
              title: item.name || item.title || 'Untitled Document',
              content: content,
              metadata: {
                  domain: item.domain || currentPath.join('/') || 'Unknown',
                  originalType: item.originalType || 'text',
                  isUserDocument: item.isUserDocument !== undefined ? item.isUserDocument : true,
                  ...(item.metadata || {})
              }
            };
          });
          if (selectedItems.length > 10) {
             console.warn(`TriangulationDemo: Too many selected docs (${selectedItems.length}), limiting to 10`);
          }
          setUseSampleDocs(false);
        } else {
          console.log(`TriangulationDemo: Not enough documents selected in context (${selectedItems?.length || 0}). Need 3 or more.`);
          setError("Please select 3 or more documents in the main panel to view the 2D Triangulation.");
          setLoading(false);
          return;
        }

        if (docsToEmbed.length < 3) {
          console.warn(`TriangulationDemo: Prepared less than 3 documents (${docsToEmbed.length}) after processing selection.`);
          setError("Need at least 3 selected documents to triangulate.");
          setLoading(false);
          return;
        }
        
        // --- Fetch coordinates from backend --- 
        console.log(`TriangulationDemo: Fetching coordinates for ${docsToEmbed.length} documents...`);
        const MAX_CONTENT_LENGTH = 20000; // Approx char limit for embedding
        const documentsForApi = docsToEmbed.map(doc => {
          // Ensure content is a string. If it's an object with a 'text' property, use that.
          let stringContent = (typeof doc.content === 'string') 
                                ? doc.content 
                                : (doc.content && typeof doc.content.text === 'string') 
                                  ? doc.content.text 
                                  : ''; // Fallback to empty string if content is unexpected

          // --- Truncate content if too long ---
          if (stringContent.length > MAX_CONTENT_LENGTH) {
            console.warn(`TriangulationDemo: Document ID ${doc.id} content truncated from ${stringContent.length} to ${MAX_CONTENT_LENGTH} chars for API call.`);
            stringContent = stringContent.substring(0, MAX_CONTENT_LENGTH);
          }
          // -------------------------------------

          if (stringContent === '') {
            console.warn(`TriangulationDemo: Document ID ${doc.id} has missing or invalid content for API call.`);
          }
          return { id: doc.id, content: stringContent };
        });
        
        const response = await fetch('http://localhost:5001/api/embed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ documents: documentsForApi }),
        });

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.coordinates_2d) {
          throw new Error('API response missing success flag or coordinates_2d');
        }
        
        console.log("TriangulationDemo: Coordinates received:", data.coordinates_2d);
        
        // Create Document instances *after* getting coordinates
        const finalDocuments = docsToEmbed.map(docData => new Document(docData));
        setDocuments(finalDocuments);
        setCoordinates(data.coordinates_2d);

      } catch (err) {
        console.error("Error loading documents or fetching coordinates:", err);
        setError(`Failed to load data: ${err.message}. Please ensure the backend is running.`);
      }
      
      setLoading(false);
    };

    loadData();
  }, [location, currentPath, selectedItems]);
  
  // Handle point analysis from the visualization
  const handleAnalyzePoint = (analysis) => {
    setSelectedPoint(analysis);
  };
  
  // Render detailed analysis if a point is selected
  const renderDetailedAnalysis = () => {
    if (!selectedPoint) return null;
    
    const { semantics, weights, triangle } = selectedPoint;
    
    return (
      <div className="detailed-analysis">
        <h3>Detailed Semantic Analysis</h3>
        
        <div className="semantic-operation">
          <h4>Semantic Operation: {semantics.setOperation.type}</h4>
          <p>{semantics.setOperation.description}</p>
          <blockquote>{semantics.setOperation.conceptual}</blockquote>
        </div>
        
        <div className="document-weights">
          <h4>Document Contributions</h4>
          {semantics.contributions.map((contribution, index) => (
            <div key={contribution.id} className="contribution-item">
              <div className="document-title">
                <strong>{contribution.title}</strong>
              </div>
              <div className="weight-bar-container">
                <div 
                  className="weight-bar" 
                  style={{
                    width: `${contribution.weight * 100}%`,
                    backgroundColor: getColorForIndex(index)
                  }}
                />
                <span className="weight-label">
                  {Math.round(contribution.weight * 100)}%
                </span>
              </div>
              <div className="document-similarity">
                Similarity: {Math.round(contribution.similarity * 100)}%
              </div>
            </div>
          ))}
        </div>
        
        <div className="document-previews">
          <h4>Document Content Previews</h4>
          {triangle.vertices.map((doc, index) => (
            <div key={doc.id} className="document-preview">
              <h5 style={{ color: getColorForIndex(index) }}>{doc.title}</h5>
              <p>{doc.getSummary(150)}</p>
              <div className="keywords">
                <strong>Keywords:</strong>{' '}
                {doc.getKeywords(5).map(k => k.word).join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Helper function to get a color for a document index
  const getColorForIndex = (index) => {
    const colors = ['#3366cc', '#dc3912', '#ff9900', '#109618', '#990099', '#0099c6', '#dd4477'];
    return colors[index % colors.length];
  };
  
  return (
    <div className="semantic-triangulation-demo">
      <div className="demo-header">
        <div className="header-top">
          <h2>Semantic Triangulation Demo</h2>
          <div className="nav-links">
            <Link to="/3d-tetrahedron" className="nav-link">
              View 3D Tetrahedron
            </Link>
            <Link to="/" className="nav-link">
              ← Back to Main App
            </Link>
          </div>
        </div>
        <p>
          This demo shows how documents can be triangulated in semantic space.
          Each triangle's interior represents weighted combinations of the documents at its vertices.
          Click inside a triangle to analyze what that specific point represents semantically.
        </p>
        {useSampleDocs && (
          <div className="sample-docs-notice">
            <strong>Note:</strong> Using {documents.length > 3 ? "some" : ""} sample documents for this demo. 
            To use only your own documents, upload at least 3 documents into the current domain.
          </div>
        )}
        {error && (
          <div className="error-notice">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
      
      <div className="demo-content">
        <div className="visualization-container">
          {loading ? (
            <div className="loading">Loading documents...</div>
          ) : documents.length < 3 ? (
            <div className="error-container">
              <p>Not enough documents to create a triangulation visualization.</p>
              <p>Please upload at least 3 documents or navigate to a domain with more documents.</p>
            </div>
          ) : (
            <SemanticTriangulationView 
              documents={documents}
              coordinates={coordinates}
              onAnalyzePoint={handleAnalyzePoint}
            />
          )}
        </div>
        
        <div className="analysis-container">
          {selectedPoint ? renderDetailedAnalysis() : (
            <div className="instructions">
              <h3>Instructions</h3>
              <p>
                Click within any triangle to analyze what that point represents 
                as a combination of the three documents at the triangle's vertices.
              </p>
              <p>
                Move your cursor around to see how the semantic meaning changes
                within each triangle.
              </p>
              <p>
                The interior points represent <strong>weighted set operations</strong> on
                the document features, with the barycentric coordinates determining
                how much each document contributes to the semantic meaning.
              </p>
            </div>
          )}
        </div>
      </div>
      
      <style jsx="true">{`
        .semantic-triangulation-demo {
          padding: 20px;
          font-family: Arial, sans-serif;
        }
        
        .demo-header {
          margin-bottom: 30px;
        }
        
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        
        .nav-links {
          display: flex;
          gap: 15px;
        }
        
        .nav-link {
          display: inline-block;
          padding: 8px 16px;
          background-color: #f2f2f2;
          border-radius: 4px;
          color: #333;
          text-decoration: none;
          font-size: 14px;
          transition: background-color 0.2s;
        }
        
        .nav-link:hover {
          background-color: #e0e0e0;
        }
        
        .sample-docs-notice {
          margin-top: 10px;
          padding: 10px;
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          color: #856404;
        }
        
        .error-notice {
          margin-top: 10px;
          padding: 10px;
          background-color: #f8d7da;
          border-left: 4px solid #dc3545;
          color: #721c24;
        }
        
        .error-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #721c24;
          text-align: center;
          padding: 20px;
        }
        
        .demo-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .visualization-container {
          width: 100%;
        }
        
        .analysis-container {
          width: 100%;
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .contribution-item {
          margin-bottom: 15px;
        }
        
        .weight-bar-container {
          height: 20px;
          background-color: #e9ecef;
          border-radius: 4px;
          margin: 5px 0;
          position: relative;
        }
        
        .weight-bar {
          height: 100%;
          border-radius: 4px;
        }
        
        .weight-label {
          position: absolute;
          right: 10px;
          top: 0;
          line-height: 20px;
          font-size: 12px;
          font-weight: bold;
          color: #212529;
          text-shadow: 0 0 2px white;
        }
        
        .document-similarity {
          font-size: 13px;
          color: #6c757d;
        }
        
        .document-preview {
          margin-bottom: 20px;
          padding: 10px;
          background-color: #fff;
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .keywords {
          font-size: 12px;
          margin-top: 10px;
          color: #6c757d;
        }
        
        .loading {
          padding: 20px;
          text-align: center;
          color: #6c757d;
        }
        
        .instructions {
          color: #495057;
        }
        
        .instructions h3 {
          color: #212529;
          margin-bottom: 15px;
        }
        
        .instructions p {
          margin-bottom: 10px;
        }
        
        .detailed-analysis h3,
        .detailed-analysis h4 {
          margin-bottom: 15px;
          color: #212529;
        }
        
        @media (min-width: 992px) {
          .demo-content {
            flex-direction: row;
          }
          
          .visualization-container {
            width: 60%;
          }
          
          .analysis-container {
            width: 40%;
          }
        }
      `}</style>
    </div>
  );
};

export default SemanticTriangulationDemo; 