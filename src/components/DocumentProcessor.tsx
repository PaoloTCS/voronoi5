import React, { useState } from 'react';
import { DocumentProcessor } from '../lib/documentProcessor';

interface DocumentProcessorProps {
  documentId: string;
  content: string;
}

export const DocumentProcessorComponent: React.FC<DocumentProcessorProps> = ({ documentId, content }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [vectorStore, setVectorStore] = useState<any>(null);
  const processor = new DocumentProcessor();

  const processDocument = async () => {
    setIsProcessing(true);
    try {
      const store = await processor.processDocument(content, documentId);
      setVectorStore(store);
    } catch (error) {
      console.error('Error processing document:', error);
    }
    setIsProcessing(false);
  };

  const askQuestion = async () => {
    if (!vectorStore || !question) return;
    
    try {
      const response = await processor.queryDocument(question, vectorStore);
      setAnswer(response);
    } catch (error) {
      console.error('Error querying document:', error);
    }
  };

  return (
    <div className="p-4">
      <button
        onClick={processDocument}
        disabled={isProcessing}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {isProcessing ? 'Processing...' : 'Process Document'}
      </button>

      {vectorStore && (
        <div className="mt-4">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about the document"
            className="w-full p-2 border rounded"
          />
          <button
            onClick={askQuestion}
            className="mt-2 bg-green-500 text-white px-4 py-2 rounded"
          >
            Ask Question
          </button>
          {answer && (
            <div className="mt-4 p-4 bg-gray-100 rounded">
              <h3 className="font-bold">Answer:</h3>
              <p>{answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 