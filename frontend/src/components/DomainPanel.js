// frontend/src/components/DomainPanel.js - Updated with document viewing and distance calc
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import DocumentUpload from './DocumentUpload';
import QuestionAnswering from './QuestionAnswering';
import { useDomains } from '../context/DomainContext';
import { formatPathForDisplay } from '../utils/pathUtils';
import DocumentProcessorComponent from './DocumentProcessorComponent';
import axios from 'axios';
import LoadingIndicator from './LoadingIndicator'; // Import LoadingIndicator

// --- Source List Definitions (Example) ---
const defaultSources = [
  { value: 'auto', label: 'Auto-Select' },
  { value: 'arxiv', label: 'arXiv' },
  { value: 'pubmed', label: 'PubMed' },
  { value: 'wikipedia', label: 'Wikipedia' },
];

const musicSources = [
  { value: 'auto', label: 'Auto-Select (Music)' },
  { value: 'oxfordmusic', label: 'Oxford Music Online' }, // Placeholder value
  { value: 'mgg', label: 'MGG Online' }, // Placeholder value
  { value: 'rilm', label: 'RILM' },
  { value: 'wikipedia', label: 'Wikipedia' },
];

const historySources = [
   { value: 'auto', label: 'Auto-Select (History)' },
   { value: 'jstor', label: 'JSTOR' },
   { value: 'projectmuse', label: 'Project MUSE' },
   { value: 'wikipedia', label: 'Wikipedia' },
   // Add more history-specific sources
];
// -----------------------------------------

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
  const { 
    documents: allDocumentsMap, 
    domains, 
    clearDocuments, 
    saveExternalPapers, 
    externalPapers, 
    selectedItems,
    setSelectedItems
  } = useDomains();

  // --- State for arXiv Feature ---
  const [arxivPapers, setArxivPapers] = useState([]);
  const [externalSource, setExternalSource] = useState('');
  const [arxivLoading, setArxivLoading] = useState(false);
  const [arxivError, setArxivError] = useState(null);
  const [selectedArxivPapers, setSelectedArxivPapers] = useState(new Set());
  // --- Add state for selected external source --- 
  const [selectedSource, setSelectedSource] = useState('auto'); // 'auto' or specific source like 'arxiv'
  // --- Add state for date filters --- 
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  // --- Add state for object type filter ---
  const [selectedObjectType, setSelectedObjectType] = useState('any'); 
  // --------------------------------------------

  // --- State for Semantic Distance Calculation ---
  const [selectedPapersForDistance, setSelectedPapersForDistance] = useState(new Set());
  const [calculatedDistance, setCalculatedDistance] = useState(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState(null);
  // --------------------------------------------

  // --- State for Combined Item Selection for Analysis ---
  const [selectedItemsForAnalysis, setSelectedItemsForAnalysis] = useState(new Set());
  // ---------------------------------------------------

  // --- Known unimplemented sources (for display message) --- 
  const unimplementedSources = useMemo(() => new Set([
    'oxfordmusic', 'mgg', 'rilm', 'jstor', 'projectmuse'
    // Add others here as needed
  ]), []);
  // -------------------------------------------------------

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

  // --- Determine Contextual Sources --- 
  const availableSources = useMemo(() => {
    const lowerCasePath = currentPath.join('/').toLowerCase();
    if (lowerCasePath.includes('music')) {
      return musicSources;
    } else if (lowerCasePath.includes('history')) {
      return historySources;
    } 
    // Add more context checks here (e.g., physics, etc.)
    else {
      return defaultSources;
    }
  }, [currentPath]);
  // ----------------------------------

  // --- Reset source, dates, type when context changes --- 
  useEffect(() => {
    const isValid = availableSources.some(source => source.value === selectedSource);
    if (!isValid) {
        setSelectedSource('auto'); 
    }
    setFromDate('');
    setToDate('');
    setSelectedObjectType('any'); // <<< Reset object type
    setExternalSource(''); 
    setArxivPapers([]); 
    setArxivError(null); 
  }, [currentPath, availableSources]); // Excluded selectedSource from deps intentionally to avoid loop
  // ------------------------------------------------------

  // --- Function to fetch external resources --- 
  const fetchExternalResources = useCallback(async () => {
    const context = isRootLevel ? 'General Science' : currentPath.join(' > ');
    console.log(`Fetching external resources for context: ${context} (Source: ${selectedSource}, Type: ${selectedObjectType}, From: ${fromDate || 'N/A'}, To: ${toDate || 'N/A'})`);

    setArxivLoading(true);
    setExternalSource(''); 
    setArxivPapers([]); 
    setArxivError(null); 

    try {
      const params = new URLSearchParams({ context });
      params.append('maxResults', '20');
      if (selectedSource !== 'auto') {
        params.append('source', selectedSource);
      }
      // --- Add object type param if not 'any' --- 
      if (selectedObjectType !== 'any') {
        params.append('type', selectedObjectType);
      }
      // ---------------------------------------
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      

      const response = await axios.get(`/api/external/resources?${params.toString()}`);
      
      if (response.data && Array.isArray(response.data.results)) {
          setArxivPapers(response.data.results);
          setExternalSource(response.data.source || 'Unknown'); 
      } else {
          console.error("Invalid response format:", response.data);
          throw new Error("Invalid response format from server.");
      }
    } catch (error) {
      console.error('Error fetching external resources:', error);
      const message = error.response?.data?.message || error.message || 'Failed to fetch resources.';
      setArxivError(`Error: ${message}`);
    } finally {
      setArxivLoading(false);
    }
  // --- Removed currentDomain from dependencies --- 
  }, [currentPath, isRootLevel, selectedSource, fromDate, toDate, selectedObjectType]);
  // ----------------------------------------------------------------------

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
      alert('Please select at least one item to save.');
      return;
    }

    const itemsToSave = arxivPapers.filter(paper => selectedArxivPapers.has(paper.id));
    
    const currentPathString = currentPath.join('/');
    if (!currentPathString) {
        alert("Error: Cannot determine the current domain path to save items.");
        return;
    }
    console.log(`Saving ${itemsToSave.length} items from ${externalSource || 'saved list'} to path: ${currentPathString}`);
    saveExternalPapers(currentPathString, itemsToSave);

    setSelectedArxivPapers(new Set());
    alert(`${itemsToSave.length} item(s) saved to the current domain.`);
  };
  // ----------------------------------------------------------

  // --- Get saved papers for the current domain ---
  const currentPathString = useMemo(() => currentPath.join('/'), [currentPath]);
  const savedPapersForCurrentDomain = useMemo(() => externalPapers[currentPathString] || [], [externalPapers, currentPathString]);
  // -----------------------------------------------

  // --- Create Combined List for Analysis Selection ---
  const currentDomainDocuments = useMemo(() => documents || [], [documents]);
  const combinedAnalysisItems = useMemo(() => {
    const combined = [];
    // Add uploaded documents
    currentDomainDocuments.forEach(doc => {
      combined.push({ 
          id: `doc::${doc.id || doc.name}`, // Use doc.id if available, fallback to name
          type: 'document',
          name: doc.name,
          title: doc.title || doc.name, // Ensure title exists
          content: doc.content, // Include content
          metadata: doc.metadata || {},
          isUserDocument: true, // Mark as user doc
          originalType: doc.originalType || 'unknown' // Include originalType
      });
    });
    // Add saved external papers
    savedPapersForCurrentDomain.forEach(paper => {
      combined.push({ 
          id: `ext::${paper.id}`, // Prefix with type 
          type: 'external',
          name: paper.title, // Use title as name for display
          title: paper.title, // Ensure title exists
          content: paper.summary, // Use summary as content for external papers
          link: paper.link, // Include link
          summary: paper.summary, // Include summary for display/info?
          authors: paper.authors,
          published: paper.published,
          metadata: paper.metadata || {}, // Include metadata if any
          isUserDocument: false, // Mark as external
          originalType: 'external-' + (paper.source || 'paper') // Mark original type
      });
    });
    return combined;
  }, [currentDomainDocuments, savedPapersForCurrentDomain]);
  // ---------------------------------------------------

  // --- Handler for Combined Item Checkbox Selection ---
  const handleAnalysisCheckboxChange = (itemId) => {
    let updatedSelectedIds = new Set();
    setSelectedItemsForAnalysis(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(itemId)) {
        newSelected.delete(itemId);
      } else {
        newSelected.add(itemId);
      }
      console.log("Selected Items for Analysis (IDs):", Array.from(newSelected)); 
      updatedSelectedIds = newSelected; // Capture the updated set
      return newSelected;
    });
    
    // --- Update the central context state ---
    // Filter combinedAnalysisItems to get the full objects for selected IDs
    const newSelectedFullItems = combinedAnalysisItems.filter(item => 
      updatedSelectedIds.has(item.id)
    );
    setSelectedItems(newSelectedFullItems); // Call the context setter
    console.log("Updated selectedItems in context:", newSelectedFullItems);
    // ----------------------------------------

    // Update selected status on the local document objects (This seems cosmetic and might be removable)
    // const docName = itemId.startsWith('doc::') ? itemId.split('::')[1] : null;
    // if (docName && documents) {
    //   const updatedDocs = documents.map(doc => {
    //     if ((doc.id || doc.name) === docName) { // Check against id or name used in combined item id
    //       return { ...doc, selected: updatedSelectedIds.has(itemId) };
    //     }
    //     return doc;
    //   });
    //   // Optionally update local documents state if needed, but context is primary now
    // }
  };
  
  // --- Direct Navigation to Visualizations ---
  const handleOpenVisualization = (type) => {
    // Remove localStorage logic - we now rely on context
    
    // Get the selected items from the central context state (obtained at top level)
    console.log(`Opening ${type} visualization with ${selectedItems.length} selected documents from context`);
    
    // Navigate directly to the route. The demo components will fetch selectedItems from context.
    if (type === '2D') {
      window.open('/semantic-triangulation', '_blank');
    } else {
      window.open('/3d-tetrahedron', '_blank');
    }
  };

  // --- Handler for Analyze Button Click (Opens New Window) ---
  const handleAnalyzeSelection = () => {
    if (selectedItemsForAnalysis.size !== 3) {
      alert("Please select exactly 3 items (documents or papers) to analyze as a triangle.");
      return;
    }
    const selectedIds = Array.from(selectedItemsForAnalysis);
    console.log("Opening Analysis (2D Triangle) for item IDs:", selectedIds);

    const queryParams = new URLSearchParams();
    selectedIds.forEach((id, index) => {
        queryParams.append(`item${index + 1}`, id); // Use generic item param name
    });
    const analysisUrl = `/analyze-triangle?${queryParams.toString()}`;
    
    window.open(analysisUrl, '_blank', 'noopener,noreferrer');
  };
  // ------------------------------------------------------

  // Render Combined Items List for Analysis Selection
  const renderCombinedItemsList = () => {
    if (combinedAnalysisItems.length === 0) {
      return <p className="empty-message">No documents or saved papers in this domain.</p>;
    }

    return (
      <>
        <div className="combined-items-list">
          {combinedAnalysisItems.map(item => (
            <div key={item.id} className="combined-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedItemsForAnalysis.has(item.id)}
                  onChange={() => handleAnalysisCheckboxChange(item.id)}
                />
                <span className={`item-name ${item.type === 'external' ? 'external-item' : ''}`}>
                  {item.name}
                </span>
                {item.type === 'document' && <span className="item-badge">(Uploaded Doc)</span>}
                {item.type === 'external' && <span className="item-badge">(External Paper)</span>}
              </label>
              {item.type === 'document' && <button className="view-button" onClick={() => handleViewDocument(documents.find(d => d.name === item.name.split('::')[1] || d.name === item.name))}>View</button>}
              {item.type === 'external' && <a href={item.link} target="_blank" rel="noopener noreferrer" className="view-button">Link</a>}
            </div>
          ))}
        </div>
        
        <div className="visualization-buttons">
          <button 
            className="visualization-button"
            onClick={() => handleOpenVisualization('2D')}
            disabled={selectedItemsForAnalysis.size < 3}
          >
            Open 2D Triangulation
          </button>
          <button 
            className="visualization-button"
            onClick={() => handleOpenVisualization('3D')}
            disabled={selectedItemsForAnalysis.size < 4}
          >
            Open 3D Tetrahedron
          </button>
          <div className="button-hint">
            {selectedItemsForAnalysis.size < 3 && "Select at least 3 documents for 2D visualization"}
            {selectedItemsForAnalysis.size >= 3 && selectedItemsForAnalysis.size < 4 && "Select 1 more document for 3D visualization"}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="domain-panel">
      {selectedDocument ? (
        // Document Viewer
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
        // Main Panel View
        <>
          {/* Domain Management Sections (Add Subdomain, Add Root Domain etc.) */}
          {isRootLevel ? (
            <div className="panel-section">
              <h3>Add New Root Domain</h3>
              <div className="subdomain-input">
                <input
                  type="text"
                  value={newRootDomain}
                  onChange={(e) => setNewRootDomain(e.target.value)}
                  placeholder="Enter new root domain name..."
                  disabled={!canAddMoreLevels}
                />
                <button onClick={handleAddRootDomain} disabled={!newRootDomain.trim() || !canAddMoreLevels}>
                  Add Root
                </button>
              </div>
              {!canAddMoreLevels && <p className="depth-indicator">Maximum hierarchy depth reached.</p>}
            </div>
          ) : currentDomain ? (
            <div className="panel-section">
              <h3>Add New Subdomain to "{currentDomain}"</h3>
              <div className="subdomain-input">
                <input
                  type="text"
                  value={newSubdomain}
                  onChange={(e) => setNewSubdomain(e.target.value)}
                  placeholder="Enter new subdomain name..."
                  disabled={!canAddMoreLevels}
                />
                <button onClick={handleAddSubdomain} disabled={!newSubdomain.trim() || !canAddMoreLevels}>
                  Add Subdomain
                </button>
              </div>
              {!canAddMoreLevels && <p className="depth-indicator">Maximum hierarchy depth reached.</p>}
              <p className="depth-indicator">Current depth: {currentDepth}/{maxDepth}</p>
            </div>
          ) : null}


          {/* Main Content Area (Tabs or Sections for Subdomains, Documents, External, etc.) */}
          {currentDomain || isRootLevel ? (
            <>
              {/* Subdomains Section */}
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

              {/* --- Combined Analysis Item List Section --- */}
              <div className="panel-section combined-analysis-list">
                <h3>Select Items for Analysis (Documents & Saved Papers)</h3>
                 {/* --- Analyze Triangle Button (Conditional) --- */} 
                 {selectedItemsForAnalysis.size === 3 && (
                     <div className="analysis-controls">
                         <button 
                             onClick={handleAnalyzeSelection}
                             className="analyze-button"
                         >
                             Analyze Triangle (2D)
                         </button>
                     </div>
                  )}
                  {/* ------------------------------------------- */} 
                 <div className="scrollable-list analysis-item-scroll-list">
                    {renderCombinedItemsList()}
                </div>
              </div>

              {/* External Resources Section */}
              {!isRootLevel && currentDomain && (
                <div className="panel-section external-papers-section">
                  <h3>External Resources</h3>
                  
                  <div className="filter-controls">
                    {/* --- Updated Source Selector --- */}
                    <div className="source-selector">
                      <label htmlFor="sourceSelect">Source: </label>
                      <select 
                        id="sourceSelect"
                        value={selectedSource}
                        onChange={(e) => setSelectedSource(e.target.value)}
                        disabled={arxivLoading}
                      >
                        {availableSources.map(source => (
                          <option key={source.value} value={source.value}>{source.label}</option>
                        ))}
                      </select>
                    </div>
                    {/* ----------------------------- */}
                    
                    {/* --- Date Filters --- */}
                    <div className="date-filter">
                       <label htmlFor="fromDate">From:</label>
                       <input 
                         type="date" 
                         id="fromDate"
                         value={fromDate}
                         onChange={(e) => setFromDate(e.target.value)}
                         disabled={arxivLoading}
                       />
                    </div>
                    <div className="date-filter">
                       <label htmlFor="toDate">To:</label>
                       <input 
                         type="date" 
                         id="toDate"
                         value={toDate}
                         onChange={(e) => setToDate(e.target.value)}
                         disabled={arxivLoading}
                       />
                    </div>
                    {/* -------------------- */}

                    {/* --- Object Type Filter --- */}
                    <div className="object-type-filter">
                       <label htmlFor="objectType">Type:</label>
                       <select 
                         id="objectType"
                         value={selectedObjectType}
                         onChange={(e) => setSelectedObjectType(e.target.value)}
                         disabled={arxivLoading}
                       >
                         <option value="any">Any</option>
                         <option value="pdf">PDF</option>
                         <option value="webpage">Webpage</option>
                         <option value="video">Video</option>
                         <option value="audio">Audio</option>
                         {/* Add more types as needed */}
                       </select>
                    </div>
                    {/* ------------------------ */}
                  </div>

                  <button
                    onClick={fetchExternalResources}
                    disabled={arxivLoading}
                    className="fetch-button"
                  >
                    {arxivLoading ? 'Searching...' : 'Find External Resources'}
                  </button>

                  {arxivLoading && <LoadingIndicator message={`Searching ${selectedSource === 'auto' ? 'external sources' : selectedSource}...`} />}
                  {arxivError && <p className="error-message">{arxivError}</p>}

                  {arxivPapers.length > 0 && (
                    <div className="arxiv-results">
                      <h4>Found Items {externalSource && `from ${externalSource.toUpperCase()}`}:</h4>
                      <div className="scrollable-list">
                        <ul>
                          {arxivPapers.map((item) => (
                            <li key={item.id} className="arxiv-paper-item">
                              <input
                                type="checkbox"
                                checked={selectedArxivPapers.has(item.id)}
                                onChange={() => handleArxivSelection(item.id)}
                                className="paper-checkbox"
                              />
                              <div className="paper-details">
                                <strong>{item.title}</strong>
                                {item.authors && item.authors.length > 0 && (
                                    <p className="authors">Authors: {item.authors.join(', ')}</p>
                                )}
                                <p className="summary">{item.summary}</p>
                                <p className="meta">
                                  {item.published && `Published: ${new Date(item.published).toLocaleDateString()} | `}
                                  <a href={item.link} target="_blank" rel="noopener noreferrer"> View Source</a>
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
                             Save Selected ({selectedArxivPapers.size}) Items Info
                         </button>
                      )}
                    </div>
                  )}
                  {/* Logic to show initial prompt or no results message - UPDATED */}
                  {!arxivLoading && !arxivError && externalSource === '' && (
                      <p className="info-text">Select a source and click 'Find External Resources' to search based on the domain context: "{currentPath.join(' > ')}".</p>
                  )}
                   {!arxivLoading && !arxivError && externalSource !== '' && arxivPapers.length === 0 && (
                       // Check if the source is known to be unimplemented
                       unimplementedSources.has(externalSource.toLowerCase()) ? (
                            <p className="info-text warning-text">Connection to '{externalSource.toUpperCase()}' is not yet implemented.</p>
                       ) : (
                            <p className="info-text">No results found from {externalSource.toUpperCase()} matching this context and filters.</p>
                       )
                  )}
                </div>
              )}

              {/* Document Upload Section */}
              {!showAllDocuments && (
                  <div className="panel-section">
                    <h3>Upload Documents</h3>
                    <DocumentUpload onDocumentUpload={onDocumentUpload} />
                  </div>
              )}
              
              {/* Question Answering Section */}
              <div className="panel-section">
                <QuestionAnswering
                  documents={documents}
                  path={currentPath.join('/')}
                />
              </div>

              {/* --- Placeholder for Local Folder Analysis --- */}
              <div className="panel-section local-analysis-placeholder">
                <h3>Local Folder Analysis</h3>
                <p className="info-text">
                  Analyze documents directly from a folder on your computer.
                </p>
                <button disabled={true} className="placeholder-button">
                  Select Folder (Coming Soon!)
                </button>
              </div>
              {/* ------------------------------------------- */}
            </>
          ) : (
            // Initial prompt if no domain selected
            <div className="panel-section info-panel">
              <p>Select a domain on the left to view details and add subdomains.</p>
              <p>You can add more root domains using the form above.</p>
            </div>
          )}
        </>
      )}

      {/* --- Styles --- */}
      <style jsx="true">{`
        .domain-panel {
          flex: 2;
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          max-height: 80vh; /* Adjust as needed */
          overflow-y: auto; /* Enable vertical scrolling */
          display: flex; /* Use flexbox for layout */
          flex-direction: column; /* Stack children vertically */
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

        .subdomain-input button,
        .navigate-button,
        .fetch-button,
        .download-button,
        .calculate-distance-button {
          padding: 10px 15px;
          color: white;
          border: none;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .subdomain-input button { background-color: #3498db; }
        .navigate-button { background-color: #3498db; padding: 4px 8px; font-size: 12px; }
        .fetch-button { background-color: #3498db; }
        .download-button { background-color: #3498db; margin-top: 15px; align-self: flex-start; }
        .calculate-distance-button { background-color: #28a745; padding: 8px 16px; }


        .subdomain-input button:hover:not(:disabled),
        .navigate-button:hover:not(:disabled),
        .fetch-button:hover:not(:disabled),
        .download-button:hover:not(:disabled),
        .calculate-distance-button:hover:not(:disabled) {
          background-color: #2980b9; /* Darker blue for most */
        }
        .calculate-distance-button:hover:not(:disabled) {
           background-color: #218838; /* Darker green */
        }

        .subdomain-input button:disabled,
        .fetch-button:disabled,
        .calculate-distance-button:disabled {
          background-color: #bdc3c7;
          cursor: not-allowed;
          opacity: 0.7;
        }


        .depth-indicator {
          margin-top: 15px;
          font-size: 12px;
          color: #999;
        }

        .document-item, .subdomain-item {
          padding: 10px 12px;
          border-bottom: 1px solid #eee;
          margin-bottom: 0; /* Reset margin */
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        .document-item:last-child, .subdomain-item:last-child { border-bottom: none; }

        .document-name, .subdomain-name {
          font-weight: 500;
          word-break: break-all;
          color: #2c3e50;
        }
        .subdomain-item:hover { background: #e9ecef; }

        .document-location {
          font-size: 12px;
          color: #666;
          font-style: italic;
        }

        .view-button {
          align-self: center; /* Re-center button vertically */
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

        .no-documents, .no-subdomains {
          padding: 15px;
          text-align: center;
          color: #999;
          font-style: italic;
          background: #f9f9f9;
          border-radius: 4px;
        }

        .all-documents, .current-documents, .scrollable-list, .saved-papers-list {
          max-height: 250px; /* Consistent max height */
          overflow-y: auto;
          padding-right: 5px; /* Space for scrollbar */
          border: 1px solid #e0e0e0;
          padding: 5px;
          margin-top: 10px;
          border-radius: 4px;
        }
         .scrollable-list ul, .saved-papers-list { /* Reset ul styles if inside */
            padding: 0;
            margin: 0;
            list-style: none;
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
           border: 1px solid #e0e0e0; /* Add border */
           border-radius: 4px;      /* Add border radius */
           max-height: 250px;       /* Limit height */
           overflow-y: auto;        /* Add scrollbar */
           padding: 5px;            /* Add padding */
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
         .clear-documents-button:disabled {
            background: #ccc;
            cursor: not-allowed;
            opacity: 0.7;
        }

        .external-papers-section {
          margin-top: 20px;
        }

        .arxiv-results {
          margin-top: 10px;
        }

        .arxiv-paper-item {
          display: flex;
          align-items: flex-start; /* Align checkbox with top of text */
          padding: 10px 8px;
          border-bottom: 1px solid #e0e0e0;
        }
         .arxiv-paper-item:last-child {
             border-bottom: none;
         }

        .paper-checkbox { /* General checkbox style */
            margin-right: 10px;
            cursor: pointer;
            flex-shrink: 0; /* Prevent shrinking */
        }

        .paper-details {
           flex: 1;
         }
         .paper-details strong {
             display: block; /* Make title block for better spacing */
             margin-bottom: 4px;
         }
         .authors, .summary, .meta {
           font-size: 12px;
           color: #555;
           line-height: 1.4;
           margin-bottom: 4px;
         }
         .authors { color: #7f8c8d; }
         .summary { max-height: 60px; overflow: hidden; text-overflow: ellipsis; } /* Limit summary lines */
         .meta { color: #7f8c8d; font-size: 11px;}
         .meta a { margin-left: 5px; }


        /* --- Saved Papers & Distance Styles --- */
        .saved-papers-section h3 {
            margin-bottom: 5px; /* Adjust spacing */
        }
        .saved-papers-section p { /* Style for instruction text */
            font-size: 14px;
            color: #666;
            margin-bottom: 15px;
        }
        .saved-papers-list { /* Shared styles with .scrollable-list */
          list-style: none;
          padding: 0;
          margin: 0 0 15px 0; /* Add margin below list */
        }
        .saved-paper-item {
          display: flex; /* Use flexbox for alignment */
          align-items: center;
          margin-bottom: 0; /* Remove bottom margin */
          padding: 8px 12px; /* Add padding */
          border-bottom: 1px solid #eee; /* Separator line */
        }
        .saved-paper-item:last-child {
            border-bottom: none; /* Remove border for last item */
        }
        /* .saved-paper-item .paper-checkbox is covered by .paper-checkbox */
        .saved-paper-item .paper-label {
            flex-grow: 1; /* Allow label to take available space */
            cursor: pointer; /* Indicate clickable label */
            margin: 0; /* Reset default label margins */
        }
        .saved-paper-item a {
          text-decoration: none;
          color: #007bff;
          font-weight: 500;
        }
        .saved-paper-item a:hover {
          text-decoration: underline;
        }
        .distance-calculator {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #eee; /* Separator line */
            display: flex;
            flex-direction: column;
            align-items: flex-start; /* Align items to the start */
            gap: 10px; /* Space between button and results */
        }
        /* .calculate-distance-button styles defined earlier */

        .distance-result {
            font-size: 14px;
            font-weight: bold;
            color: #333;
            background-color: #e8f4fd; // Light blue background
            padding: 8px 12px;
            border-radius: 4px;
        }
        .distance-info {
            font-weight: normal;
            font-size: 12px;
            color: #666;
        }
        .error-message { /* General error style */
            color: #dc3545; // Red for errors
            font-size: 14px;
            margin-top: 5px;
            background-color: #f8d7da; /* Light red background */
            padding: 8px 12px;
            border-radius: 4px;
            border: 1px solid #f5c6cb; /* Red border */
        }
        /* --- End Saved Papers & Distance Styles --- */

        .document-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .analysis-controls {
          display: flex;
          justify-content: flex-end;
          margin-top: 10px;
        }

        .analyze-button {
          padding: 8px 16px;
          background-color: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .analyze-button:hover {
          background-color: #2980b9;
        }

        /* Styles for Combined Analysis List */
        .combined-analysis-list .analysis-controls {
            margin-bottom: 10px; /* Space above list */
        }
        .analysis-item {
           display: flex;
           align-items: center;
           padding: 8px 5px;
           border-bottom: 1px solid #eee;
           gap: 8px;
        }
        .analysis-item:last-child { border-bottom: none; }
        .analysis-item .analysis-checkbox {
            flex-shrink: 0;
        }
        .analysis-item-label {
            flex-grow: 1;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            flex-wrap: wrap; /* Allow wrapping */
        }
        .analysis-item .item-name {
            font-weight: 500;
        }
        .analysis-item .item-type {
            font-size: 0.8em;
            color: #666;
            background-color: #f0f0f0;
            padding: 2px 4px;
            border-radius: 3px;
        }
        .analysis-item .item-link {
            font-size: 0.8em;
            margin-left: auto; /* Push link to right */
        }
        .view-button-inline {
            /* Basic styling for inline view button */
            padding: 2px 6px;
            font-size: 0.8em;
            background-color: #eee;
            border: 1px solid #ccc;
            border-radius: 3px;
            cursor: pointer;
            margin-left: 5px;
        }
        .view-button-inline:hover { background-color: #ddd; }

        .disabled-label {
            opacity: 0.6;
            cursor: not-allowed;
        }
        /* Add subtle style for disabled checkbox itself if needed */
        .analysis-checkbox:disabled {
            cursor: not-allowed;
        }

        .visualization-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 15px;
        }

        .visualization-button {
          background-color: #4a90e2;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        .visualization-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }

        .visualization-button:not(:disabled):hover {
          background-color: #3a7bcb;
        }

        .button-hint {
          color: #666;
          font-size: 12px;
          margin-top: 5px;
          font-style: italic;
        }

        .external-papers-section button.fetch-button {
             margin-top: 0; /* Reset margin as it's below the filter container now */
        }

        .source-selector,
        .date-filter,
        .object-type-filter { /* Add new filter class */
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
        }
        .source-selector label,
        .date-filter label,
        .object-type-filter label { /* Add new filter class */
            font-weight: 500;
        }
        .source-selector select,
        .date-filter input,
        .object-type-filter select { /* Add new filter class */
            padding: 5px 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            background-color: white;
        }
        .source-selector select:disabled,
        .date-filter input:disabled,
        .object-type-filter select:disabled { /* Add new filter class */
            background-color: #eee;
            cursor: not-allowed;
        }
        /* Add style for unimplemented source warning */
        .warning-text {
            color: #856404; /* Dark yellow */
            background-color: #fff3cd; /* Light yellow background */
            padding: 8px 12px;
            border-radius: 4px;
            border: 1px solid #ffeeba; /* Yellow border */
        }

        .local-analysis-placeholder {
            /* Optional: specific styles if needed */
            border-style: dashed;
            border-color: #ccc;
            background-color: #fafafa;
        }
        .placeholder-button {
            background-color: #bdc3c7; /* Grey */
            color: #666;
            border: none;
            border-radius: 4px;
            padding: 8px 16px;
            cursor: not-allowed;
            font-size: 14px;
            margin-top: 10px;
        }
      `}</style>
    </div>
  );
};

export default DomainPanel;