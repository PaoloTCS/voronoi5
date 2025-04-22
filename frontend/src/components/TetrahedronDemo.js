import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Document from '../models/Document';
import TetrahedronVisualization from '../semantic/TetrahedronVisualization';
import { useDomains } from '../context/DomainContext';
import { getAllAvailableDocuments } from '../semantic/documentConverter';

const TetrahedronDemo = () => {
  const [documents, setDocuments] = useState([]);
  const [coordinates, setCoordinates] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [useSampleDocs, setUseSampleDocs] = useState(false);
  const [error, setError] = useState(null);
  
  // --- State for LLM Analysis ---
  const [llmAnalysisResult, setLlmAnalysisResult] = useState(null);
  const [isLlmLoading, setIsLlmLoading] = useState(false);
  // -----------------------------
  
  const location = useLocation();
  
  const {
    getCurrentDocuments,
    getPathString,
    externalPapers,
    currentPath,
    allDocuments,
    selectedItems,
    allDomains
  } = useDomains();
  
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      setDocuments([]);
      setCoordinates(null);

      let docsToEmbed = [];

      try {
        if (!currentPath) {
          setError("Current domain path is not available. Please navigate to a domain.");
          setLoading(false);
          return;
        }

        console.log("TetrahedronDemo: Checking selected items from context:", selectedItems);

        if (selectedItems && selectedItems.length >= 4) {
          console.log(`TetrahedronDemo: Using ${selectedItems.length} selected documents from context for path:`, currentPath.join('/'));
          docsToEmbed = selectedItems.slice(0, 4).map(item => {
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
          setUseSampleDocs(false);
        } else {
          console.log(`TetrahedronDemo: Not enough documents selected in context (${selectedItems?.length || 0}). Need 4.`);
          setError("Please select exactly 4 documents in the main panel to view the 3D Tetrahedron.");
          setLoading(false);
          return;
        }

        if (docsToEmbed.length !== 4) {
           console.error(`TetrahedronDemo: Incorrect number of documents prepared (${docsToEmbed.length}). Expected 4.`);
           setError(`Internal error: Prepared ${docsToEmbed.length} documents instead of 4.`);
           setLoading(false);
           return;
        }

        let fetchedEmbeddings = {};

        console.log(`TetrahedronDemo: Fetching coordinates and embeddings for ${docsToEmbed.length} documents...`);
        const MAX_CONTENT_LENGTH = 20000;
        const documentsForApi = docsToEmbed.map(doc => {
          let stringContent = (typeof doc.content === 'string') 
                                ? doc.content 
                                : (doc.content && typeof doc.content.text === 'string') 
                                  ? doc.content.text 
                                  : '';
          
          if (stringContent.length > MAX_CONTENT_LENGTH) {
            console.warn(`TetrahedronDemo: Document ID ${doc.id} content truncated from ${stringContent.length} to ${MAX_CONTENT_LENGTH} chars for API call.`);
            stringContent = stringContent.substring(0, MAX_CONTENT_LENGTH);
          }

          if (stringContent === '') {
            console.warn(`TetrahedronDemo: Document ID ${doc.id} has missing or invalid content for API call.`);
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

        if (!data.success || !data.coordinates_3d || !data.embeddings) {
          console.error("API response error. Data received:", data);
          throw new Error('API response missing success flag, coordinates_3d, or embeddings');
        }
        
        console.log("TetrahedronDemo: Coordinates received:", data.coordinates_3d);
        console.log("TetrahedronDemo: Embeddings received (keys):", Object.keys(data.embeddings));
        fetchedEmbeddings = data.embeddings;
        
        const finalDocuments = docsToEmbed.map(docData => {
          const doc = new Document(docData);
          if (fetchedEmbeddings[doc.id]) {
            doc.embedding = fetchedEmbeddings[doc.id];
          } else {
            console.warn(`Embedding not found for document ${doc.id}`);
          }
          return doc;
        });

        setDocuments(finalDocuments);
        setCoordinates(data.coordinates_3d);

      } catch (err) {
        console.error("Error loading documents or fetching coordinates:", err);
        setError(`Failed to load data: ${err.message}. Please ensure the backend is running.`);
      }
      
      setLoading(false);
    };

    loadData();
  }, [location, currentPath, selectedItems]);

  const handlePointSelected = (pointData) => {
    console.log("TetrahedronDemo: Received point data:", JSON.stringify(pointData, null, 2)); 
    setSelectedPoint(pointData);
  };

  // --- Handle LLM Analysis Request --- 
  const handleGetLlmAnalysis = async () => {
    if (!selectedPoint || !selectedPoint.contributions || !selectedPoint.isInside) {
      console.error("Cannot get LLM analysis without valid selected point data.");
      return;
    }

    setIsLlmLoading(true);
    setLlmAnalysisResult('Generating analysis...'); // Show loading message

    // Prepare data for backend
    const analysisPayload = {
      contributions: selectedPoint.contributions, // Array of { id, title, weight, similarity }
      // We could potentially add summaries or full text here if needed by the backend prompt
      // documents: selectedPoint.documents.map(doc => ({ id: doc.id, title: doc.title, summary: doc.getSummary(100) }))
    };

    try {
      const response = await fetch('http://localhost:5001/api/analyze-point', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `API request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.analysis) {
        setLlmAnalysisResult(data.analysis); // Display successful analysis
      } else {
        throw new Error(data.message || 'LLM analysis failed or returned invalid format.');
      }

    } catch (err) {
      console.error("Error fetching LLM analysis:", err);
      setLlmAnalysisResult(`Error: ${err.message}`); // Display error message
    } finally {
      setIsLlmLoading(false);
    }
  };
  // --------------------------------

  return (
    <div className="tetrahedron-demo">
      <div className="demo-header">
        <div className="header-top">
          <h2>3D Semantic Tetrahedron Demo</h2>
          <div className="nav-links">
            <Link to="/semantic-triangulation" className="nav-link">
              View 2D Triangulation
            </Link>
            <Link to="/" className="nav-link">
              ← Back to Main App
            </Link>
          </div>
        </div>
        <p>
          This demo extends semantic triangulation into 3D space, allowing for more 
          complex semantic relationships between documents. Each tetrahedron represents 
          a combination of four documents, with interior points representing weighted combinations.
        </p>
        {useSampleDocs && (
          <div className="sample-docs-notice">
            <strong>Note:</strong> Using {documents.length > 4 ? "some" : ""} sample documents for this demo. 
            To use only your own documents, upload at least 4 documents into the current domain.
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
            <div className="loading">Loading documents and creating 3D visualization...</div>
          ) : documents.length < 4 ? (
            <div className="error-container">
              <p>Not enough documents to create a tetrahedron visualization.</p>
              <p>Please upload at least 4 documents or navigate to a domain with more documents.</p>
            </div>
          ) : (
            <TetrahedronVisualization 
              documents={documents} 
              coordinates={coordinates}
              onPointSelected={handlePointSelected}
            />
          )}
        </div>
        
        <div className="info-panel">
          {selectedPoint ? (
            <div className="point-analysis">
              <h3>Point Analysis</h3>
              <div className="weights-display">
                <h4>Document Contributions</h4>
                {selectedPoint.weights.map((weight, idx) => (
                  <div key={idx} className="weight-item">
                    <span className="doc-title" style={{color: selectedPoint.colors[idx]}}>
                      {selectedPoint.documents[idx].title}
                    </span>
                    <div className="weight-bar-container">
                      <div 
                        className="weight-bar" 
                        style={{
                          width: `${Math.max(0.5, weight * 100)}%`, 
                          backgroundColor: selectedPoint.colors[idx]
                        }}
                      />
                      <span className="weight-label">{(weight * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="semantic-analysis">
                <h4>Semantic Analysis</h4>
                {selectedPoint.contributions ? (
                  (() => {
                    // Filter contributions above a threshold (e.g., 5%)
                    const significantContributions = selectedPoint.contributions
                      .filter(c => c.weight > 0.05)
                      .sort((a, b) => b.weight - a.weight); // Sort by weight descending
                    
                    let description = 'Mixture of documents';
                    if (significantContributions.length === 0) {
                      description = 'Represents a point far from any document (or error).'; // Should ideally not happen if inside
                    } else if (significantContributions.length === 1) {
                      description = `Primarily represents: ${significantContributions[0].title}`;
                    } else {
                      description = `Represents a blend, strongly influenced by: ${significantContributions.map(c => c.title).join(', ')}`;
                    }
                    
                    const conceptual = `This point combines the semantic features of the documents based on their proximity in the embedding space, weighted by barycentric coordinates.`;
                    
                    return (
                      <>
                        <p><strong>Generated Description:</strong></p>
                        <p>{description}</p>
                        <blockquote>{conceptual}</blockquote>
                      </>
                    );
                  })()
                ) : (
                  <p>Could not generate semantic description.</p>
                )}
              </div>

              <div className="clicked-point-details">
                <h4>Detailed Point Info</h4>
                <p>
                  <strong>Coordinates (Scaled Space):</strong> 
                  ({selectedPoint.point ? selectedPoint.point.map(p => p.toFixed(2)).join(', ') : 'N/A'})
                </p>
                <p>
                  <strong>Status:</strong> 
                  {selectedPoint.isInside !== undefined ? (selectedPoint.isInside ? 'Inside Tetrahedron' : 'Outside Tetrahedron') : 'N/A'}
                </p>
                {selectedPoint.isInside && selectedPoint.weights && (
                    <p>
                      <strong>Barycentric Weights:</strong> 
                      ({selectedPoint.weights.map(w => w.toFixed(3)).join(', ')})
                    </p>
                )}
                <div className="llm-analysis-section">
                  <button 
                    disabled={!selectedPoint || !selectedPoint.isInside || isLlmLoading}
                    onClick={handleGetLlmAnalysis} 
                    className="llm-button"
                    title={
                      !selectedPoint ? "Click inside the tetrahedron to select a point."
                      : !selectedPoint.isInside ? "Select a point inside the tetrahedron to enable analysis."
                      : isLlmLoading ? "Analysis is in progress..."
                      : "Get detailed semantic analysis using LLM"
                    }
                  >
                    {isLlmLoading ? 'Analyzing...' : 'Get Detailed Analysis (LLM)'}
                  </button>
                  {/* --- Area to display LLM result --- */}
                  {llmAnalysisResult && (
                    <div className="llm-result">
                      <p>{llmAnalysisResult}</p>
                    </div>
                  )}
                  {/* ---------------------------------- */}
                </div>
              </div>

            </div>
          ) : (
            <div className="instructions">
              <h3>Instructions</h3>
              <p>
                Click on the visualization to select a point within a tetrahedron.
                The analysis will show how that point represents a combination of 
                the four documents that form the tetrahedron.
              </p>
              <p>
                <strong>Controls:</strong>
              </p>
              <ul>
                <li>Left-click + drag: Rotate view</li>
                <li>Right-click + drag: Pan view</li>
                <li>Scroll: Zoom in/out</li>
                <li>Click on any point: View semantic analysis</li>
              </ul>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        .tetrahedron-demo {
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
          height: 500px;
          background-color: #f8f9fa;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .info-panel {
          width: 100%;
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .point-analysis h3,
        .instructions h3 {
          margin-bottom: 15px;
          color: #212529;
        }
        
        .weights-display {
          margin-bottom: 20px;
        }
        
        .weights-display h4,
        .semantic-analysis h4 {
          margin-bottom: 10px;
          color: #212529;
        }
        
        .weight-item {
          margin-bottom: 10px;
          padding-top: 5px;
          padding-bottom: 5px;
          min-height: 25px;
          border-bottom: 1px solid #eee;
        }
        .weight-item:last-child {
            border-bottom: none;
        }
        
        .doc-title {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
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
          min-width: 2px;
          transition: width 0.2s ease-out;
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
        
        .semantic-analysis blockquote {
          margin: 15px 0;
          padding: 10px 15px;
          background-color: #e9ecef;
          border-left: 4px solid #6c757d;
          font-style: italic;
        }
        
        .instructions ul {
          margin-left: 20px;
          margin-bottom: 15px;
        }
        
        .instructions li {
          margin-bottom: 5px;
        }
        
        .loading {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6c757d;
        }
        
        .clicked-point-details {
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px dashed #ccc;
        }
        .clicked-point-details h4 {
            margin-top: 0;
            margin-bottom: 10px;
            font-size: 14px;
            color: #333;
        }
        .clicked-point-details p {
            font-size: 13px;
            margin-bottom: 5px;
        }
        
        .llm-analysis-section {
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px solid #eee;
        }
        .llm-button {
            background-color: #5bc0de;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 13px;
            transition: background-color 0.2s;
        }
        .llm-button:hover:not(:disabled) {
            background-color: #31b0d5;
        }
        .llm-button:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
            opacity: 0.7;
        }
        
        /* Style for LLM result area */
        .llm-result {
            margin-top: 10px;
            padding: 10px;
            background-color: #e9f5ff; /* Lighter blue background */
            border-radius: 4px;
            border: 1px solid #bce8f1; /* Light blue border */
            font-size: 14px;
            white-space: pre-wrap; /* Preserve line breaks from LLM */
        }
        .llm-result p {
            margin: 0;
        }
        
        @media (min-width: 992px) {
          .demo-content {
            flex-direction: row;
          }
          
          .visualization-container {
            width: 65%;
            height: 600px;
          }
          
          .info-panel {
            width: 35%;
          }
        }
      `}</style>
    </div>
  );
};

export default TetrahedronDemo; 