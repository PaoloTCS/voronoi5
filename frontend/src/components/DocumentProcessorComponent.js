import React, { useState, useEffect } from 'react';
import { DocumentProcessor } from '../lib/documentProcessor';

const DocumentProcessorComponent = ({ documentId, content }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [vectorStore, setVectorStore] = useState(null);
  const [processedChunks, setProcessedChunks] = useState(null);
  const [entities, setEntities] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [error, setError] = useState(null);
  const [apiKeyStatus, setApiKeyStatus] = useState('checking');
  
  const processor = React.useMemo(() => new DocumentProcessor(), []);

  useEffect(() => {
    // Test API key when component mounts
    const testApiKey = async () => {
      try {
        const isWorking = await processor.testApiKey();
        if (isWorking) {
          setApiKeyStatus('valid');
        } else {
          setApiKeyStatus('invalid');
          setError('OpenAI API key is not working. Please check your configuration.');
        }
      } catch (err) {
        console.error('Error testing API key:', err);
        setApiKeyStatus('invalid');
        setError('Failed to test OpenAI API key. Please check your configuration.');
      }
    };

    testApiKey();
  }, [processor]);

  const processDocument = async () => {
    if (apiKeyStatus !== 'valid') {
      setError('Please fix the OpenAI API key configuration before processing documents.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const result = await processor.processDocument(content, documentId);
      setVectorStore(true);  // Just set to true as an indication that processing completed
      setProcessedChunks(result.processedChunks);
      
      // Initialize empty entities and relationships since we don't have that data anymore
      setEntities([]);
      setRelationships([]);
      
    } catch (error) {
      console.error('Error processing document:', error);
      setError('Failed to process document');
    }
    setIsProcessing(false);
  };

  const askQuestion = async () => {
    if (!vectorStore || !question || apiKeyStatus !== 'valid') return;
    
    try {
      const response = await processor.queryDocument(question, documentId);
      setAnswer(response);
    } catch (error) {
      console.error('Error querying document:', error);
      setError('Failed to get answer');
    }
  };

  return (
    <div className="document-processor">
      {apiKeyStatus === 'checking' && (
        <div className="api-status checking">
          Checking API key configuration...
        </div>
      )}
      
      {apiKeyStatus === 'invalid' && (
        <div className="api-status invalid">
          OpenAI API key is not configured correctly. Please check your .env file.
        </div>
      )}

      <button
        onClick={processDocument}
        disabled={isProcessing || apiKeyStatus !== 'valid'}
        className="process-button"
      >
        {isProcessing ? 'Processing...' : 'Process Document'}
      </button>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {processedChunks && (
        <div className="analysis-results">
          <h4>Document Analysis</h4>
          <div className="processing-summary">
            <p>Document successfully processed into {processedChunks} chunks.</p>
            <p>Document vectors have been stored and are ready for querying.</p>
          </div>
          
          {/* Conditional rendering for future entity and relationship extraction */}
          {entities.length > 0 && (
            <div className="entities-section">
              <h5>Entities Found ({entities.length})</h5>
              <div className="entities-list">
                {entities.map((entity, index) => (
                  <span key={index} className="entity-tag">{entity}</span>
                ))}
              </div>
            </div>
          )}
          
          {relationships.length > 0 && (
            <div className="relationships-section">
              <h5>Relationships ({relationships.length})</h5>
              <div className="relationships-list">
                {relationships.map((rel, index) => (
                  <div key={index} className="relationship-item">
                    <span className="source">{rel.source}</span>
                    <span className="type">{rel.type}</span>
                    <span className="target">{rel.target}</span>
                    <span className="confidence">({(rel.confidence * 100).toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {vectorStore && (
        <div className="query-section">
          <input
            type="text"
            id="document-question"
            name="document-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about this document..."
            className="question-input"
          />
          <button
            onClick={askQuestion}
            className="ask-button"
          >
            Ask Question
          </button>
          {answer && (
            <div className="answer-section">
              <h4>Answer:</h4>
              <p>{answer}</p>
            </div>
          )}
        </div>
      )}
      
      <style jsx="true">{`
        .document-processor {
          margin-top: 15px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        
        .api-status {
          padding: 10px;
          margin-bottom: 15px;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .processing-summary {
          background-color: #e8f4fd;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 15px;
        }
        
        .processing-summary p {
          margin: 0 0 8px 0;
          color: #2980b9;
        }
        
        .api-status.checking {
          background: #fff3cd;
          color: #856404;
        }
        
        .api-status.invalid {
          background: #f8d7da;
          color: #721c24;
        }
        
        .process-button {
          padding: 8px 16px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }
        
        .process-button:disabled {
          background: #bdc3c7;
          cursor: not-allowed;
        }
        
        .error-message {
          margin-top: 10px;
          padding: 10px;
          background: #f8d7da;
          color: #721c24;
          border-radius: 4px;
        }
        
        .analysis-results {
          margin-top: 20px;
          padding: 15px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .entities-section, .relationships-section {
          margin-bottom: 20px;
        }
        
        .entities-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }
        
        .entity-tag {
          padding: 4px 8px;
          background: #e1f0fa;
          color: #2980b9;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .relationships-list {
          margin-top: 10px;
        }
        
        .relationship-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: #f8f9fa;
          border-radius: 4px;
          margin-bottom: 8px;
        }
        
        .source, .target {
          font-weight: bold;
          color: #2c3e50;
        }
        
        .type {
          color: #7f8c8d;
        }
        
        .confidence {
          color: #95a5a6;
          font-size: 12px;
        }
        
        .query-section {
          margin-top: 15px;
        }
        
        .question-input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin-bottom: 10px;
        }
        
        .ask-button {
          padding: 8px 16px;
          background: #2ecc71;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }
        
        .answer-section {
          margin-top: 15px;
          padding: 10px;
          background: white;
          border-radius: 4px;
          border: 1px solid #e0e0e0;
        }
        
        .answer-section h4 {
          margin: 0 0 10px 0;
          color: #2c3e50;
        }
        
        .answer-section p {
          margin: 0;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
};

export default DocumentProcessorComponent; 