import React, { useState, useEffect } from 'react';
import { 
  findMatchingDocuments, 
  generateHypotheticalDocument, 
  suggestSearchTerms,
  generateSearchQuery
} from '../semantic/documentSearch';

/**
 * Component to find and display "missing documents" based on triangle interior points
 */
const MissingDocumentFinder = ({ 
  semantics, 
  allDocuments = [], 
  excludeDocIds = [],
  onSearch,
  onImport
}) => {
  const [matchingDocuments, setMatchingDocuments] = useState([]);
  const [hypotheticalDoc, setHypotheticalDoc] = useState(null);
  const [searchTerms, setSearchTerms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!semantics || !semantics.combinedEmbedding) return;
    
    setLoading(true);
    
    // Find matching documents based on the interior point embedding
    const matches = findMatchingDocuments(
      semantics.combinedEmbedding,
      allDocuments,
      excludeDocIds,
      0.65, // Lower threshold to find more potential matches
      5     // Limit to top 5 results
    );
    
    // Generate a hypothetical document from the interior point
    const contributionsMap = {};
    semantics.contributions.forEach(c => {
      contributionsMap[c.title] = c.weight;
    });
    
    const hypothetical = generateHypotheticalDocument(
      semantics.combinedEmbedding,
      contributionsMap
    );
    
    // Generate suggested search terms
    const terms = suggestSearchTerms(semantics, allDocuments);
    
    // Generate search query
    const query = generateSearchQuery(semantics);
    
    setMatchingDocuments(matches);
    setHypotheticalDoc(hypothetical);
    setSearchTerms(terms);
    setSearchQuery(query);
    setLoading(false);
  }, [semantics, allDocuments, excludeDocIds]);
  
  const handleExternalSearch = () => {
    if (onSearch && searchQuery) {
      onSearch(searchQuery);
    }
  };
  
  const handleImportDoc = (doc) => {
    if (onImport && doc) {
      onImport(doc);
    }
  };
  
  if (loading) {
    return <div className="loading">Analyzing semantic space...</div>;
  }
  
  return (
    <div className="missing-document-finder">
      <h3>Semantic Gap Analysis</h3>
      
      {hypotheticalDoc && (
        <div className="hypothetical-document">
          <h4>Hypothetical Document</h4>
          <div className="doc-title">{hypotheticalDoc.title}</div>
          
          <div className="contributions">
            <strong>Composition:</strong>
            <ul>
              {hypotheticalDoc.contributingDocs.map(doc => (
                <li key={doc.title}>
                  {doc.title}: {Math.round(doc.weight * 100)}%
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {searchTerms.length > 0 && (
        <div className="search-terms">
          <h4>Suggested Search Terms</h4>
          <div className="terms-container">
            {searchTerms.map(term => (
              <span key={term.word} className="search-term-chip">
                {term.word}
              </span>
            ))}
          </div>
        </div>
      )}
      
      <div className="search-actions">
        <h4>Search for Similar Documents</h4>
        <div className="search-query">
          <input 
            type="text" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search query..."
          />
          <button 
            className="search-button"
            onClick={handleExternalSearch}
            disabled={!searchQuery.trim()}
          >
            Search
          </button>
        </div>
      </div>
      
      {matchingDocuments.length > 0 ? (
        <div className="matching-documents">
          <h4>Potentially Related Documents</h4>
          <ul className="document-list">
            {matchingDocuments.map(({ document, similarity }) => (
              <li key={document.id} className="document-item">
                <div className="document-title">{document.title}</div>
                <div className="document-similarity">
                  Similarity: {Math.round(similarity * 100)}%
                </div>
                <button 
                  className="import-button"
                  onClick={() => handleImportDoc(document)}
                >
                  Import to Triangle
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="no-matches">
          <p>No closely matching documents found in your collection.</p>
          <p>This could indicate a gap in your knowledge domain that might be worth exploring.</p>
        </div>
      )}
      
      <style jsx>{`
        .missing-document-finder {
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 8px;
          margin-top: 20px;
        }
        
        h3 {
          margin-top: 0;
          color: #333;
        }
        
        .hypothetical-document {
          background-color: #fff;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .doc-title {
          font-weight: bold;
          font-size: 16px;
          margin-bottom: 10px;
        }
        
        .search-terms {
          margin-bottom: 20px;
        }
        
        .terms-container {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        
        .search-term-chip {
          background-color: #e9ecef;
          padding: 5px 10px;
          border-radius: 15px;
          font-size: 12px;
        }
        
        .search-query {
          display: flex;
          margin-bottom: 20px;
        }
        
        .search-query input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px 0 0 4px;
        }
        
        .search-button {
          background-color: #3366cc;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 0 4px 4px 0;
          cursor: pointer;
        }
        
        .search-button:disabled {
          background-color: #a0a0a0;
          cursor: not-allowed;
        }
        
        .document-list {
          list-style: none;
          padding: 0;
        }
        
        .document-item {
          background-color: #fff;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 10px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .document-title {
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .document-similarity {
          font-size: 12px;
          color: #666;
          margin-bottom: 8px;
        }
        
        .import-button {
          background-color: #28a745;
          color: white;
          border: none;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        
        .no-matches {
          background-color: #fff;
          padding: 15px;
          border-radius: 6px;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default MissingDocumentFinder; 