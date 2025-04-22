import React, { useState } from 'react';
import LoadingIndicator from './LoadingIndicator';
import { DocumentProcessor } from '../lib/documentProcessor';

const QuestionAnswering = ({ documents, path }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState({});
  const [error, setError] = useState(null);
  
  // Initialize document processor
  const processor = React.useMemo(() => new DocumentProcessor(), []);
  
  // Initialize selected documents
  React.useEffect(() => {
    const initialSelection = {};
    documents.forEach(doc => {
      initialSelection[doc.name] = true;
    });
    setSelectedDocs(initialSelection);
  }, [documents]);
  
  const toggleDocument = (docName) => {
    setSelectedDocs(prev => ({
      ...prev,
      [docName]: !prev[docName]
    }));
  };
  
  const askQuestion = async () => {
    if (!question.trim() || documents.length === 0) return;
    
    setLoading(true);
    setAnswer('');
    setError(null);
    
    try {
      // Filter documents based on selection
      const selectedDocuments = documents.filter(doc => selectedDocs[doc.name]);
      
      if (selectedDocuments.length === 0) {
        setAnswer('Please select at least one document to analyze.');
        return;
      }
      
      // Process each selected document and get answers
      const answers = await Promise.all(
        selectedDocuments.map(async doc => {
          const content = doc.content;
          const text = typeof content === 'string' ? content : 
                      content?.text ? content.text :
                      content?.preview ? content.preview : 
                      'No readable content available';
          
          return await processor.queryDocument(question, doc.name);
        })
      );
      
      // Combine answers if multiple documents were selected
      const finalAnswer = answers.length > 1 
        ? "Based on the selected documents:\n\n" + answers.join("\n\n")
        : answers[0];
      
      setAnswer(finalAnswer);
    } catch (error) {
      console.error('Error asking question:', error);
      setError(`Error analyzing documents: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  if (documents.length === 0) {
    return (
      <div className="question-answering empty">
        <h3>Document Q&A</h3>
        <p>Upload documents to enable Q&A functionality</p>
        
        <style jsx="true">{`
          .question-answering.empty {
            color: #999;
            text-align: center;
            padding: 30px 15px;
            background-color: white;
            border-radius: 6px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
          }
          
          .question-answering h3 {
            margin-top: 0;
            color: #2c3e50;
          }
        `}</style>
      </div>
    );
  }
  
  return (
    <div className="question-answering">
      <h3>Ask Questions About Your Documents</h3>
      
      <div className="document-selection">
        <h4>Select Documents to Analyze:</h4>
        <div className="document-checkboxes">
          {documents.map((doc, index) => (
            <label key={index} className="document-checkbox">
              <input
                type="checkbox"
                id={`doc-${index}`}
                name={`doc-${index}`}
                checked={selectedDocs[doc.name] || false}
                onChange={() => toggleDocument(doc.name)}
              />
              <span className="document-name">{doc.name}</span>
            </label>
          ))}
        </div>
      </div>
      
      <div className="question-input">
        <input
          type="text"
          id="question-input"
          name="question-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about your selected documents..."
          onKeyPress={(e) => {
            if (e.key === 'Enter') askQuestion();
          }}
        />
        <button 
          onClick={askQuestion}
          disabled={loading || !question.trim()}
        >
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </div>
      
      {loading && (
        <div className="loading-answer">
          <LoadingIndicator message="Analyzing documents and generating answer..." size="small" />
        </div>
      )}
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {answer && (
        <div className="answer-container">
          <h4>Answer:</h4>
          <div className="answer">
            {answer.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      )}
      
      <style jsx="true">{`
        .question-answering {
          padding: 15px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        }
        
        .document-selection {
          margin-bottom: 15px;
        }
        
        .document-checkboxes {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 10px;
        }
        
        .document-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: #f8f9fa;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .document-checkbox:hover {
          background: #e9ecef;
        }
        
        .document-checkbox input[type="checkbox"] {
          margin: 0;
        }
        
        .document-name {
          font-size: 14px;
          color: #2c3e50;
        }
        
        .question-input {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
        }
        
        .question-input input {
          flex: 1;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .question-input button {
          padding: 10px 20px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }
        
        .question-input button:disabled {
          background: #bdc3c7;
          cursor: not-allowed;
        }
        
        .loading-answer {
          margin: 15px 0;
        }
        
        .answer-container {
          margin-top: 15px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 4px;
        }
        
        .answer-container h4 {
          margin: 0 0 10px 0;
          color: #2c3e50;
        }
        
        .answer p {
          margin: 0 0 10px 0;
          line-height: 1.5;
        }
        
        .answer p:last-child {
          margin-bottom: 0;
        }
        
        .error-message {
          margin-top: 10px;
          padding: 10px;
          background-color: #f8d7da;
          color: #721c24;
          border-radius: 4px;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default QuestionAnswering;