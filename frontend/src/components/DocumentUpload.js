// frontend/src/components/DocumentUpload.js - Updated version with better error handling
import React, { useState } from 'react';
import LoadingIndicator from './LoadingIndicator';

const DocumentUpload = ({ onDocumentUpload }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };
  
  const handleChange = (e) => {
    e.preventDefault();
    
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };
  
  const handleFile = async (file) => {
    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Create a FormData object to send the file to the backend
      const formData = new FormData();
      formData.append('file', file);
      
      // Get current path from URL or context
      // This is a simplified version; you might need to adjust based on your app's routing
      const pathSegments = window.location.pathname.split('/').filter(Boolean);
      const path = pathSegments.length > 0 ? pathSegments.join('/') : 'root';
      
      formData.append('path', path);
      
      // Send the file to the backend for processing
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload document');
      }
      
      const result = await response.json();
      
      // Create a content object that includes both original file info and extracted text
      const content = {
        fileName: file.name,
        type: file.type,
        size: file.size,
        // The extracted text from the backend
        text: result.textContent,
        // For UI display purposes
        originalType: file.type,
        processed: true,
        uploadDate: new Date().toISOString()
      };
      
      // Call the callback with the document info
      onDocumentUpload(file.name, content);
      
      // Show success message
      setSuccess(`${file.name} processed and uploaded successfully!`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error processing file:", err);
      setError(`Failed to process file: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="document-upload">
      <h3>Upload Documents</h3>
      
      <form 
        className={`upload-form ${dragActive ? "drag-active" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          id="file-upload"
          name="file-upload"
          onChange={handleChange}
          accept=".txt,.pdf,.doc,.docx"
        />
        
        <label htmlFor="file-upload" className="upload-label">
          {uploading ? (
            <LoadingIndicator message="Processing document..." size="small" />
          ) : (
            <>
              <div className="upload-icon">📄</div>
              <p>Drag and drop a document here, or click to select</p>
              <p className="upload-hint">Supported formats: .txt, .pdf, .doc, .docx</p>
            </>
          )}
        </label>
      </form>
      
      {error && (
        <div className="upload-error">
          {error}
        </div>
      )}
      
      {success && (
        <div className="upload-success">
          {success}
        </div>
      )}
      
      <style jsx="true">{`
        .document-upload {
          margin-bottom: 20px;
          padding: 15px;
          background-color: white;
          border-radius: 6px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        }
        
        .document-upload h3 {
          margin-top: 0;
          color: #2c3e50;
          margin-bottom: 15px;
        }
        
        .upload-form {
          position: relative;
          border: 2px dashed #ccc;
          border-radius: 6px;
          padding: 25px;
          text-align: center;
          transition: all 0.3s ease;
        }
        
        .upload-form.drag-active {
          border-color: #3498db;
          background-color: rgba(52, 152, 219, 0.05);
        }
        
        .upload-form input[type="file"] {
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          opacity: 0;
          cursor: pointer;
        }
        
        .upload-label {
          display: block;
          cursor: pointer;
        }
        
        .upload-icon {
          font-size: 40px;
          margin-bottom: 10px;
        }
        
        .upload-hint {
          color: #999;
          font-size: 12px;
          margin-top: 5px;
        }
        
        .upload-error {
          margin-top: 10px;
          padding: 10px;
          background-color: #f8d7da;
          color: #721c24;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .upload-success {
          margin-top: 10px;
          padding: 10px;
          background-color: #d4edda;
          color: #155724;
          border-radius: 4px;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default DocumentUpload;