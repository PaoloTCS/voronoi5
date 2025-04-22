// frontend/src/components/SplashPage.js
import React, { useState } from 'react';

const SplashPage = ({ onStart }) => {
  const [interests, setInterests] = useState(['', '', '']);
  const [error, setError] = useState('');
  
  const handleInterestChange = (index, value) => {
    const newInterests = [...interests];
    newInterests[index] = value;
    setInterests(newInterests);
  };
  
  const addInterestField = () => {
    setInterests([...interests, '']);
  };
  
  const removeInterestField = (index) => {
    if (interests.length > 3) {
      const newInterests = [...interests];
      newInterests.splice(index, 1);
      setInterests(newInterests);
    }
  };
  
  const handleSubmit = () => {
    // Filter out empty inputs
    const validInterests = interests.filter(interest => interest.trim() !== '');
    
    if (validInterests.length < 3) {
      setError('Please enter at least 3 interests to continue');
      return;
    }
    
    onStart(validInterests);
  };
  
  return (
    <div className="splash-container">
      <div className="splash-card">
        <h1>Semantic Voronoi Tessellation Explorer v3</h1>
        
        <div className="app-description">
          <p>
            Welcome to the Semantic Voronoi Tessellation Explorer! This application creates
            interactive visualizations of your knowledge domains based on semantic relationships.
          </p>
          <p>
            Domains that are semantically similar appear closer together in the visualization.
            You can create nested hierarchies of subdomains, upload documents, and ask questions
            about your documents.
          </p>
        </div>
        
        <div className="get-started">
          <h2>Get Started</h2>
          <p>Enter at least 3 interests or domains to begin:</p>
          
          {interests.map((interest, index) => (
            <div key={index} className="interest-input">
              <input
                type="text"
                value={interest}
                onChange={(e) => handleInterestChange(index, e.target.value)}
                placeholder={`Interest ${index + 1}`}
              />
              {interests.length > 3 && (
                <button 
                  className="remove-button"
                  onClick={() => removeInterestField(index)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          
          <button className="add-button" onClick={addInterestField}>
            + Add another interest
          </button>
          
          {error && <p className="error-message">{error}</p>}
          
          <button className="create-button" onClick={handleSubmit}>
            Create My Voronoi Map
          </button>
        </div>
      </div>
      
      <style jsx="true">{`
        .splash-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          padding: 20px;
        }
        
        .splash-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          max-width: 800px;
          width: 100%;
          padding: 40px;
        }
        
        h1 {
          color: #2c3e50;
          text-align: center;
          margin-bottom: 30px;
        }
        
        .app-description {
          margin-bottom: 30px;
          line-height: 1.6;
        }
        
        .get-started h2 {
          color: #3498db;
          margin-bottom: 15px;
        }
        
        .interest-input {
          display: flex;
          margin-bottom: 15px;
        }
        
        .interest-input input {
          flex: 1;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 16px;
        }
        
        .remove-button {
          background: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 6px;
          margin-left: 10px;
          cursor: pointer;
          color: #e74c3c;
          font-weight: bold;
        }
        
        .add-button {
          background: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 10px 15px;
          margin-bottom: 20px;
          cursor: pointer;
          width: 100%;
        }
        
        .error-message {
          color: #e74c3c;
          margin-bottom: 15px;
        }
        
        .create-button {
          background: #3498db;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 15px;
          font-size: 18px;
          font-weight: bold;
          width: 100%;
          cursor: pointer;
          transition: background 0.3s;
        }
        
        .create-button:hover {
          background: #2980b9;
        }
      `}</style>
    </div>
  );
};

export default SplashPage;