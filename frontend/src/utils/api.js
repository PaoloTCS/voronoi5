/**
 * API client for backend communication
 */
import axios from 'axios';

// Base API URL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// API endpoints
export const api = {
  // Embeddings
  getEmbeddings: async (domains) => {
    try {
      const response = await apiClient.post('/embeddings', { domains });
      return response.data;
    } catch (error) {
      console.error('Error fetching embeddings:', error);
      throw error;
    }
  },
  
  // Document handling
  uploadDocument: async (path, file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', path);
      
      const response = await apiClient.post('/documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  },
  
  // Question answering
  askQuestion: async (question, path, documents = null) => {
    try {
      const payload = { question };
      
      if (path) {
        payload.path = path;
      } else if (documents) {
        payload.documents = documents;
      }
      
      const response = await apiClient.post('/ask', payload);
      return response.data;
    } catch (error) {
      console.error('Error asking question:', error);
      throw error;
    }
  },
  
  // Mock API for development (no backend needed)
  mock: {
    getEmbeddings: (domains) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const embeddings = {};
          domains.forEach(domain => {
            embeddings[domain] = [
              Math.random() * 800 + 50,  // x between 50 and 850
              Math.random() * 500 + 50   // y between 50 and 550
            ];
          });
          resolve({ embeddings });
        }, 1000);
      });
    },
    
    uploadDocument: (path, file) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            message: 'Document processed successfully',
            fileName: file.name
          });
        }, 1500);
      });
    },
    
    askQuestion: (question, path, documents) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const answer = `This is a simulated answer to your question about "${question}". 
            In a real implementation, LangChain would analyze your documents and provide a relevant answer.`;
          resolve({ answer });
        }, 1500);
      });
    }
  }
};

export default api;