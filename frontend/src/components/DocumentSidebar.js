// frontend/src/components/DocumentSidebar.js
import React, { useState } from 'react';
import { useDomains } from '../context/DomainContext';
import { pathStringToArray } from '../utils/pathUtils';

const DocumentSidebar = () => {
  const { documents, navigateTo } = useDomains();
  const [isOpen, setIsOpen] = useState(false);
  
  // Get all documents across all domains
  const getAllDocuments = () => {
    const allDocs = [];
    
    Object.entries(documents).forEach(([path, docs]) => {
      if (docs && docs.length > 0) {
        docs.forEach(doc => {
          allDocs.push({
            path,
            pathArray: pathStringToArray(path),
            name: doc.name,
            content: doc.content
          });
        });
      }
    });
    
    return allDocs;
  };
  
  const allDocuments = getAllDocuments();
  
  // Group documents by domains
  const groupByDomain = () => {
    const groups = {};
    
    allDocuments.forEach(doc => {
      const key = doc.path || 'root';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(doc);
    });
    
    return groups;
  };
  
  const docGroups = groupByDomain();
  
  // Handle navigation to a document's location
  const navigateToDocument = (doc) => {
    navigateTo(doc.pathArray.length);
    setIsOpen(false);
  };
  
  // Format path for display
  const formatPath = (path) => {
    if (!path || path === '') return 'Root Level';
    return path.split('/').join(' > ');
  };
  
  return (
    <div className={`document-sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div 
        className="sidebar-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? '◀' : '▶'} {allDocuments.length} Documents
      </div>
      
      <div className="sidebar-content">
        <h3>All Documents ({allDocuments.length})</h3>
        
        {Object.keys(docGroups).length === 0 ? (
          <div className="no-documents">
            <p>No documents have been uploaded yet.</p>
          </div>
        ) : (
          Object.entries(docGroups).map(([path, docs]) => (
            <div key={path} className="document-group">
              <h4 className="group-title">{formatPath(path)}</h4>
              <ul className="document-list">
                {docs.map((doc, index) => (
                  <li key={index} className="document-item">
                    <span className="document-name">{doc.name}</span>
                    <button
                      className="goto-button"
                      onClick={() => navigateToDocument(doc)}
                    >
                      Go To
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
      
      <style jsx="true">{`
        .document-sidebar {
          position: fixed;
          top: 0;
          bottom: 0;
          right: 0;
          width: 300px;
          background: white;
          box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease;
          z-index: 1000;
          display: flex;
          flex-direction: column;
        }
        
        .document-sidebar.closed {
          transform: translateX(calc(100% - 40px));
        }
        
        .sidebar-toggle {
          padding: 10px;
          background: #3498db;
          color: white;
          cursor: pointer;
          font-weight: bold;
          display: flex;
          align-items: center;
        }
        
        .sidebar-content {
          padding: 15px;
          overflow-y: auto;
          flex: 1;
        }
        
        .sidebar-content h3 {
          margin-top: 0;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
          color: #2c3e50;
        }
        
        .document-group {
          margin-bottom: 20px;
        }
        
        .group-title {
          font-size: 14px;
          color: #666;
          background: #f8f9fa;
          padding: 8px 10px;
          margin: 0 0 10px 0;
          border-radius: 4px;
        }
        
        .document-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .document-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        
        .document-name {
          font-size: 14px;
          color: #333;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .goto-button {
          background: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
          margin-left: 10px;
        }
        
        .goto-button:hover {
          background: #e9ecef;
        }
        
        .no-documents {
          color: #999;
          font-style: italic;
          text-align: center;
          padding: 20px 0;
        }
      `}</style>
    </div>
  );
};

export default DocumentSidebar;