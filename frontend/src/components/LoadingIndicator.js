import React from 'react';

const LoadingIndicator = ({ message = 'Loading...', size = 'medium' }) => {
  const getSize = () => {
    switch (size) {
      case 'small':
        return { width: '20px', height: '20px' };
      case 'large':
        return { width: '50px', height: '50px' };
      default:
        return { width: '30px', height: '30px' };
    }
  };
  
  const sizeStyle = getSize();
  
  return (
    <div className="loading-indicator">
      <div className="spinner" style={sizeStyle}></div>
      {message && <div className="loading-message">{message}</div>}
      
      <style jsx="true">{`
        .loading-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        
        .spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          border-radius: 50%;
          border-top: 4px solid #3498db;
          animation: spin 1s linear infinite;
        }
        
        .loading-message {
          margin-top: 15px;
          color: #666;
          font-size: 14px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingIndicator;