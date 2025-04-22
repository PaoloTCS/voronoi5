// frontend/src/components/DomainPanel.js - Updated with document viewing
import React, { useState, useCallback, useMemo } from 'react';
import DocumentUpload from './DocumentUpload';
import QuestionAnswering from './QuestionAnswering';
import { useDomains } from '../context/DomainContext';
import { formatPathForDisplay } from '../utils/pathUtils';
import DocumentProcessorComponent from './DocumentProcessorComponent';
import axios from 'axios';

const DomainPanel = ({ 
  currentDomain, 
  currentPath = [],
  onAddSubdomain,
  onAddRootDomain,
  onDocumentUpload,
  onDomainSelect,
  documents,
  maxDepth = 10,
  isRootLevel = false
}) => {
  const [newSubdomain, setNewSubdomain] = useState('');
  const [newRootDomain, setNewRootDomain] = useState('');
  const [showAllDocuments, setShowAllDocuments] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const { documents: allDocumentsMap, domains, clearDocuments, saveExternalPapers, externalPapers } = useDomains();
  
  // --- State for arXiv Feature ---
  const [arxivPapers, setArxivPapers] = useState([]);
  const [arxivLoading, setArxivLoading] = useState(false);
  const [arxivError, setArxivError] = useState(null);
  const [selectedArxivPapers, setSelectedArxivPapers] = useState(new Set());
  // --------------------------------
  
  // Get current subdomains
  const getCurrentSubdomains = () => {
    if (isRootLevel) return [];
    if (!Array.isArray(currentPath)) return [];
    const pathString = currentPath.join('/');
    return domains.children[pathString] || [];
  };
  
  const currentSubdomains = getCurrentSubdomains();
  
  const handleAddSubdomain = () => {
    if (newSubdomain.trim()) {
      onAddSubdomain(newSubdomain.trim());
      setNewSubdomain('');
    }
  };
  
  const handleAddRootDomain = () => {
    if (newRootDomain.trim()) {
      onAddRootDomain(newRootDomain.trim());
      setNewRootDomain('');
    }
  };
  
  const handleViewDocument = (doc) => {
    setSelectedDocument(doc);
  };
  
  const handleCloseDocument = () => {
    setSelectedDocument(null);
  };
  
  // Make sure currentPath is an array before accessing its length
  const currentDepth = Array.isArray(currentPath) ? currentPath.length : 0;
  const canAddMoreLevels = currentDepth < maxDepth;
  
  // Get all documents across all domains
  const getAllDocuments = () => {
    const allDocs = [];
    
    Object.entries(allDocumentsMap).forEach(([path, docs]) => {
      if (docs && docs.length > 0) {
        docs.forEach(doc => {
          allDocs.push({
            path,
            location: formatPathForDisplay(path),
            name: doc.name,
            content: doc.content
          });
        });
      }
    });
    
    return allDocs;
  };
  
  const allDocuments = getAllDocuments();
  const hasDocuments = documents && documents.length > 0;
  const hasAnyDocuments = allDocuments.length > 0;
  
  const handleClearDocuments = () => {
    if (window.confirm('Are you sure you want to clear all documents? This action cannot be undone.')) {
      clearDocuments();
      setShowAllDocuments(false);
    }
  };
  
  // --- Function to fetch arXiv papers ---
  const fetchArxivPapers = useCallback(async () => {
    if (!currentDomain && !isRootLevel) {
      setArxivError("Cannot fetch papers without a current domain context.");
      return;
    }
    // Use the most specific context available (full path if not root)
    const context = isRootLevel ? 'General Science' : currentPath.join(' > '); 
    console.log(`Fetching arXiv papers for context: ${context}`);

    setArxivLoading(true);
    setArxivError(null);
    setArxivPapers([]); // Clear previous results
    setSelectedArxivPapers(new Set()); // Clear selections

    try {
      // Construct query params
      const params = new URLSearchParams({ context });
      // Explicitly request more results
      params.append('maxResults', '50'); 

      // Use relative path due to proxy setup in package.json
      const response = await axios.get(`/api/external/papers?${params.toString()}`);
      
      if (response.data && Array.isArray(response.data)) {
          setArxivPapers(response.data);
          if (response.data.length === 0) {
              console.log("No papers found for this context.");
              // Optionally set a specific message instead of error
              // setArxivError("No recent papers found matching this context."); 
          }
      } else {
          throw new Error("Invalid response format from server.");
      }
    } catch (error) {
      console.error('Error fetching arXiv papers:', error);
      const message = error.response?.data?.message || error.message || 'Failed to fetch papers.';
      setArxivError(`Error: ${message}`);
    } finally {
      setArxivLoading(false);
    }
  }, [currentDomain, currentPath, isRootLevel]); // Dependencies for useCallback
  // ---------------------------------------

  // --- Function to handle arXiv paper selection ---
  const handleArxivSelection = (paperId) => {
    setSelectedArxivPapers(prevSelected => {
        const newSelected = new Set(prevSelected);
        if (newSelected.has(paperId)) {
            newSelected.delete(paperId);
        } else {
            newSelected.add(paperId);
        }
        return newSelected;
    });
  };
  // --------------------------------------------
  
  // --- Function to handle saving selected arXiv paper metadata ---
  const handleSaveSelection = () => {
    if (selectedArxivPapers.size === 0) {
      alert('Please select at least one paper to save.');
      return;
    }

    // Get the full paper objects for the selected IDs
    const papersToSave = arxivPapers.filter(paper => selectedArxivPapers.has(paper.id));
    
    // Get the current domain path string
    const currentPathString = currentPath.join('/');
    
    if (!currentPathString) {
        alert("Error: Cannot determine the current domain path to save papers.");
        return;
    }

    console.log(`Saving ${papersToSave.length} papers to path: ${currentPathString}`);
    saveExternalPapers(currentPathString, papersToSave);

    // Optionally clear selection after saving
    setSelectedArxivPapers(new Set());
    // Provide user feedback (e.g., using a temporary message state or alert)
    alert(`${papersToSave.length} paper(s) saved to the current domain.`);

  };
  // ----------------------------------------------------------
  
  // --- Get saved papers for the current domain --- 
  const currentPathString = useMemo(() => currentPath.join('/'), [currentPath]);
  const savedPapersForCurrentDomain = useMemo(() => externalPapers[currentPathString] || [], [externalPapers, currentPathString]);
  // -----------------------------------------------
  
  return (
    <div className="domain-panel">
      {selectedDocument ? (
        <div className="document-viewer">
          <div className="document-viewer-header">
            <h3>{selectedDocument.name}</h3>
            <button 
              className="close-button"
              onClick={handleCloseDocument}
            >
              Close
            </button>
          </div>
          <div className="document-content">
            {typeof selectedDocument.content === 'string' 
              ? selectedDocument.content.split('\n').map((line, index) => (
                  <p key={index}>{line}</p>
                ))
              : selectedDocument.content && selectedDocument.content.text
                ? (
                  <div className="processed-content">
                    <div className="document-info">
                      <div className="document-icon">
                        {selectedDocument.content.type?.includes('pdf') ? '📕' : 
                         selectedDocument.content.type?.includes('word') ? '📘' : '📄'}
                      </div>
                      <div className="document-metadata">
                        <h4>{selectedDocument.content.fileName}</h4>
                        <p className="document-type">
                          Original type: {selectedDocument.content.originalType || selectedDocument.content.type || 'Unknown'}
                        </p>
                        {selectedDocument.content.uploadDate && (
                          <p className="document-date">
                            Uploaded: {new Date(selectedDocument.content.uploadDate).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="document-text">
                      <h5>Extracted Text Content:</h5>
                      <div className="text-content">
                        {selectedDocument.content.text.split('\n').map((line, index) => (
                          <p key={index}>{line}</p>
                        ))}
                      </div>
                    </div>
                    <div className="document-querying">
                      <h5>Document Analysis</h5>
                      <DocumentProcessorComponent 
                        documentId={selectedDocument.name}
                        content={selectedDocument.content.text}
                      />
                    </div>
                  </div>
                )
                : selectedDocument.content && selectedDocument.content.binary
                  ? (
                    <div className="binary-content">
                      <div className="binary-icon">📄</div>
                      <h4>{selectedDocument.content.fileName}</h4>
                      <p className="binary-type">Type: {selectedDocument.content.type || 'Binary document'}</p>
                      <p className="binary-message">{selectedDocument.content.preview || 'This document format cannot be displayed in text view.'}</p>
                    </div>
                  )
                  : <p>This document format cannot be displayed. Please convert to text format.</p>
            }
          </div>
        </div>
      ) : (
        <>
          <h2>{isRootLevel ? 'Root Level Domains' : currentDomain}</h2>
          
          {isRootLevel && (
            <div className="panel-section">
              <h3>Add New Root Domain</h3>
              <div className="subdomain-input">
                <input 
                  type="text" 
                  id="new-root-domain"
                  name="new-root-domain"
                  placeholder="New domain name"
                  value={newRootDomain}
                  onChange={(e) => setNewRootDomain(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleAddRootDomain();
                  }}
                />
                <button onClick={handleAddRootDomain}>Add Domain</button>
              </div>
              <p className="info-text">Add more domains to create a richer semantic map</p>
            </div>
          )}
          
          {currentDomain ? (
            <>
              {canAddMoreLevels && (
                <div className="panel-section">
                  <h3>Add Subdomain {currentDepth > 0 ? `(Level ${currentDepth})` : ''}</h3>
                  <div className="subdomain-input">
                    <input 
                      type="text" 
                      id="new-subdomain"
                      name="new-subdomain"
                      placeholder="New subdomain name"
                      value={newSubdomain}
                      onChange={(e) => setNewSubdomain(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleAddSubdomain();
                      }}
                    />
                    <button onClick={handleAddSubdomain}>Add</button>
                  </div>
                  {currentDepth > 0 && (
                    <div className="depth-indicator">
                      Current depth: Level {currentDepth} 
                      {maxDepth !== Infinity && (
                        <span> (Max: Level {maxDepth})</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Subdomain List Section */}
              <div className="panel-section">
                <h3>Subdomains</h3>
                <div className="subdomain-list">
                  {currentSubdomains.length > 0 ? (
                    currentSubdomains.map((subdomain, index) => (
                      <div key={index} className="subdomain-item">
                        <span className="subdomain-name">{subdomain}</span>
                        <button 
                          className="navigate-button"
                          onClick={() => onDomainSelect(subdomain)}
                        >
                          Navigate
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="no-subdomains">No subdomains yet</p>
                  )}
                </div>
              </div>
              
              {/* --- Saved External Paper Links Section --- */}
              {savedPapersForCurrentDomain.length > 0 && (
                <div className="panel-section saved-papers-section">
                  <h3>Saved External Paper Links</h3>
                  <ul className="saved-papers-list">
                    {savedPapersForCurrentDomain.map((paper) => (
                      <li key={paper.id} className="saved-paper-item">
                        <a href={paper.link} target="_blank" rel="noopener noreferrer" title={`Authors: ${paper.authors.join(', ')}\nPublished: ${new Date(paper.published).toLocaleDateString()}`}>
                          {paper.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* --------------------------------------- */}

              {/* External Papers Section */}
              {!isRootLevel && currentDomain && (
                <div className="panel-section external-papers-section">
                  <h3>External Resources (arXiv)</h3>
                  <button 
                    onClick={fetchArxivPapers} 
                    disabled={arxivLoading}
                    className="fetch-button"
                  >
                    {arxivLoading ? 'Searching...' : 'Find Recent Papers'}
                  </button>

                  {arxivError && <p className="error-message">{arxivError}</p>}

                  {arxivPapers.length > 0 && (
                    <div className="arxiv-results">
                      <h4>Found Papers:</h4>
                      <div className="scrollable-list">
                        <ul>
                          {arxivPapers.map((paper) => (
                            <li key={paper.id} className="arxiv-paper-item">
                              <input 
                                type="checkbox"
                                checked={selectedArxivPapers.has(paper.id)}
                                onChange={() => handleArxivSelection(paper.id)}
                                className="paper-checkbox"
                              />
                              <div className="paper-details">
                                <strong>{paper.title}</strong>
                                <p className="authors">Authors: {paper.authors.join(', ')}</p>
                                <p className="summary">{paper.summary}</p>
                                <p className="meta">
                                  Published: {new Date(paper.published).toLocaleDateString()} | 
                                  <a href={paper.link} target="_blank" rel="noopener noreferrer"> View on arXiv</a>
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {selectedArxivPapers.size > 0 && (
                         <button 
                            className="download-button" 
                            onClick={handleSaveSelection}
                          >
                             Save Selected ({selectedArxivPapers.size}) Papers Info
                         </button>
                      )}
                    </div>
                  )}
                  {!arxivLoading && !arxivError && arxivPapers.length === 0 && (
                      <p className="info-text">Click 'Find Recent Papers' to search arXiv based on the domain context: "{currentPath.join(' > ')}".</p>
                  )}
                </div>
              )}
              
              {/* Document List Section */}
              <div className="panel-section">
                <div className="section-header">
                  <h3>Document List</h3>
                  <div className="view-toggle">
                    <label>
                      <input 
                        type="checkbox" 
                        checked={showAllDocuments}
                        onChange={() => setShowAllDocuments(!showAllDocuments)}
                      />
                      Show all documents ({allDocuments.length})
                    </label>
                    <button 
                      className="clear-documents-button"
                      onClick={handleClearDocuments}
                    >
                      Clear All Documents
                    </button>
                  </div>
                </div>
                
                {showAllDocuments ? (
                  hasAnyDocuments ? (
                    <div className="all-documents">
                      {allDocuments.map((doc, index) => (
                        <div key={index} className="document-item">
                          <div className="document-name">{doc.name}</div>
                          <div className="document-location">Location: {doc.location}</div>
                          <button 
                            className="view-button"
                            onClick={() => handleViewDocument(doc)}
                          >
                            View Content
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-documents">No documents uploaded yet</div>
                  )
                ) : (
                  hasDocuments ? (
                    <div className="current-documents">
                      {documents.map((doc, index) => (
                        <div key={index} className="document-item">
                          <div className="document-name">{doc.name}</div>
                          <button 
                            className="view-button"
                            onClick={() => handleViewDocument(doc)}
                          >
                            View Content
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-documents">
                      No documents in this domain. Upload one below.
                    </div>
                  )
                )}
              </div>
              
              <div className="panel-section">
                <DocumentUpload 
                  onDocumentUpload={onDocumentUpload} 
                />
              </div>
              
              <div className="panel-section">
                <QuestionAnswering 
                  documents={documents}
                  path={currentPath.join('/')} 
                />
              </div>
            </>
          ) : (
            <div className="panel-section info-panel">
              <p>Select a domain on the left to view details and add subdomains.</p>
              <p>You can add more root domains using the form above.</p>
            </div>
          )}
        </>
      )}
      
      <style jsx="true">{`
        .domain-panel {
          flex: 2;
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          max-height: 80vh;
          overflow-y: auto;
        }
        
        .domain-panel h2 {
          margin-top: 0;
          padding-bottom: 10px;
          border-bottom: 1px solid #ddd;
          color: #3498db;
        }
        
        .panel-section {
          margin-bottom: 25px;
          padding: 15px;
          background-color: white;
          border-radius: 6px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        }
        
        .panel-section h3 {
          margin-top: 0;
          color: #2c3e50;
          margin-bottom: 15px;
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        
        .section-header h3 {
          margin: 0;
        }
        
        .view-toggle {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        
        .view-toggle label {
          display: flex;
          align-items: center;
          cursor: pointer;
        }
        
        .view-toggle input {
          margin-right: 5px;
        }
        
        .subdomain-input {
          display: flex;
          gap: 10px;
        }
        
        .subdomain-input input {
          flex: 1;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .subdomain-input button {
          padding: 10px 15px;
          background-color: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
        }
        
        .depth-indicator {
          margin-top: 15px;
          font-size: 12px;
          color: #999;
        }
        
        .document-item {
          padding: 10px;
          border: 1px solid #eee;
          border-radius: 4px;
          margin-bottom: 10px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        
        .document-name {
          font-weight: bold;
          margin-bottom: 5px;
          word-break: break-all;
        }
        
        .document-location {
          font-size: 12px;
          color: #666;
          font-style: italic;
        }
        
        .view-button {
          align-self: flex-start;
          padding: 5px 10px;
          background-color: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }
        
        .view-button:hover {
          background-color: #e9ecef;
        }
        
        .no-documents {
          padding: 15px;
          text-align: center;
          color: #999;
          font-style: italic;
          background: #f9f9f9;
          border-radius: 4px;
        }
        
        .all-documents, .current-documents {
          max-height: 200px;
          overflow-y: auto;
          padding-right: 5px;
        }
        
        .document-viewer {
          background: white;
          border-radius: 8px;
          padding: 20px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        .document-viewer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px solid #eee;
        }
        
        .document-viewer-header h3 {
          margin: 0;
          color: #2c3e50;
        }
        
        .close-button {
          padding: 5px 10px;
          background-color: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .document-content {
          flex: 1;
          overflow-y: auto;
          background: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          line-height: 1.6;
        }
        
        .document-content p {
          margin: 0 0 10px 0;
        }
        
        .binary-content {
          text-align: center;
          padding: 30px;
        }
        
        .binary-icon {
          font-size: 60px;
          margin-bottom: 15px;
          color: #3498db;
        }
        
        .binary-content h4 {
          margin: 10px 0;
          font-size: 18px;
          color: #2c3e50;
        }
        
        .binary-type {
          color: #7f8c8d;
          font-size: 14px;
          margin-bottom: 20px;
        }
        
        .binary-message {
          background: #f1f1f1;
          padding: 15px;
          border-radius: 6px;
          color: #555;
        }
        
        .processed-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .document-info {
          display: flex;
          gap: 15px;
          padding: 15px;
          background: #f1f9ff;
          border-radius: 8px;
          margin-bottom: 10px;
        }
        
        .document-icon {
          font-size: 40px;
          color: #3498db;
        }
        
        .document-metadata {
          flex: 1;
        }
        
        .document-metadata h4 {
          margin: 0 0 8px 0;
          color: #2c3e50;
        }
        
        .document-type, .document-date {
          margin: 0 0 5px 0;
          font-size: 13px;
          color: #7f8c8d;
        }
        
        .document-text {
          background: white;
          padding: 15px;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
        }
        
        .document-text h5 {
          margin: 0 0 15px 0;
          padding-bottom: 8px;
          color: #2c3e50;
          border-bottom: 1px solid #eee;
        }
        
        .text-content {
          max-height: 400px;
          overflow-y: auto;
          padding-right: 10px;
        }
        
        .text-content p {
          margin: 0 0 10px 0;
          line-height: 1.5;
        }
        
        .info-text {
          color: #666;
          font-size: 14px;
          margin-top: 8px;
        }
        
        .info-panel {
          background-color: #e8f4f8;
          border-radius: 8px;
          padding: 15px;
          line-height: 1.5;
        }
        
        .subdomain-list {
          margin-top: 10px;
        }
        
        .subdomain-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          margin-bottom: 8px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .subdomain-item:hover {
          background: #e9ecef;
        }
        
        .subdomain-name {
          font-weight: 500;
          color: #2c3e50;
        }
        
        .navigate-button {
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
          transition: background-color 0.2s;
        }
        
        .navigate-button:hover {
          background: #2980b9;
        }
        
        .no-subdomains {
          color: #6c757d;
          font-style: italic;
          text-align: center;
          padding: 10px;
        }
        
        .clear-documents-button {
          padding: 4px 8px;
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        
        .clear-documents-button:hover {
          background: #c0392b;
        }
        
        .external-papers-section {
          margin-top: 20px;
        }
        
        .fetch-button {
          padding: 10px 20px;
          background-color: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
          margin-bottom: 10px;
        }
        
        .fetch-button:hover {
          background-color: #2980b9;
        }
        
        .arxiv-results {
          margin-top: 10px;
        }
        
        .arxiv-paper-item {
          display: flex;
          align-items: center;
          padding: 8px;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .paper-checkbox {
          margin-right: 10px;
        }
        
        .paper-details {
          flex: 1;
        }
        
        .authors {
          color: #7f8c8d;
          font-size: 12px;
        }
        
        .summary {
          color: #555;
          font-size: 12px;
        }
        
        .meta {
          color: #7f8c8d;
          font-size: 12px;
        }
        
        .download-button {
          padding: 10px 20px;
          background-color: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
          margin-top: 10px;
        }
        
        .download-button:hover {
          background-color: #2980b9;
        }
        
        .saved-papers-section {
          margin-top: 20px;
          background-color: #f8f9fa; /* Light background */
          padding: 15px;
          border-radius: 4px;
          border: 1px solid #e9ecef;
        }
        .saved-papers-section h3 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #495057;
        }
        .saved-papers-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .saved-paper-item {
          margin-bottom: 8px;
          padding: 5px 0;
          border-bottom: 1px dashed #dee2e6;
        }
        .saved-paper-item a {
          text-decoration: none;
          color: #007bff;
          font-weight: 500;
        }
        .saved-paper-item a:hover {
          text-decoration: underline;
        }
        .scrollable-list {
          max-height: 400px; /* Adjust as needed */
          overflow-y: auto;
          border: 1px solid #e0e0e0; /* Optional border */
          padding: 5px;
          margin-top: 10px;
        }
        .scrollable-list ul {
            padding: 0;
            margin: 0;
            list-style: none;
        }
      `}</style>
    </div>
  );
};

export default DomainPanel;