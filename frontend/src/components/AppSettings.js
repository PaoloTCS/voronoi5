import React, { useState } from 'react';

const AppSettings = ({ 
  maxDepth, 
  onChangeMaxDepth,
  onReset 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempMaxDepth, setTempMaxDepth] = useState(maxDepth);
  
  const handleSave = () => {
    onChangeMaxDepth(parseInt(tempMaxDepth));
    setIsOpen(false);
  };
  
  const handleCancel = () => {
    setTempMaxDepth(maxDepth);
    setIsOpen(false);
  };
  
  return (
    <div className="app-settings">
      <button 
        className="settings-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        ⚙️ Settings
      </button>
      
      {isOpen && (
        <div className="settings-panel">
          <h3>Application Settings</h3>
          
          <div className="setting-group">
            <label htmlFor="max-depth">Maximum Hierarchy Depth:</label>
            <input 
              type="number" 
              id="max-depth"
              min="1"
              max="100"
              value={tempMaxDepth}
              onChange={(e) => setTempMaxDepth(e.target.value)}
            />
            <p className="setting-help">
              Maximum number of nested subdomain levels allowed.
              Set higher for deeper hierarchies.
            </p>
          </div>
          
          <div className="setting-actions">
            <button className="save-button" onClick={handleSave}>
              Save Settings
            </button>
            <button className="cancel-button" onClick={handleCancel}>
              Cancel
            </button>
          </div>
          
          <div className="danger-zone">
            <h4>Danger Zone</h4>
            <button 
              className="reset-button"
              onClick={() => {
                if (window.confirm('Are you sure you want to reset all data? This cannot be undone.')) {
                  onReset();
                  setIsOpen(false);
                }
              }}
            >
              Reset All Data
            </button>
          </div>
        </div>
      )}
      
      <style jsx="true">{`
        .app-settings {
          position: relative;
          margin-bottom: 20px;
        }
        
        .settings-toggle {
          background: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }
        
        .settings-toggle:hover {
          background: #e9ecef;
        }
        
        .settings-panel {
          position: absolute;
          top: 40px;
          right: 0;
          width: 300px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 20px;
          z-index: 100;
        }
        
        .settings-panel h3 {
          margin-top: 0;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
          margin-bottom: 15px;
          color: #333;
        }
        
        .setting-group {
          margin-bottom: 20px;
        }
        
        .setting-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: bold;
          color: #555;
        }
        
        .setting-group input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        .setting-help {
          margin-top: 6px;
          color: #888;
          font-size: 12px;
        }
        
        .setting-actions {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        
        .save-button {
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          cursor: pointer;
          flex: 1;
        }
        
        .save-button:hover {
          background: #2980b9;
        }
        
        .cancel-button {
          background: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 8px 16px;
          cursor: pointer;
          flex: 1;
        }
        
        .danger-zone {
          border-top: 1px solid #eee;
          padding-top: 15px;
        }
        
        .danger-zone h4 {
          color: #e74c3c;
          margin-bottom: 10px;
        }
        
        .reset-button {
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          cursor: pointer;
          width: 100%;
        }
        
        .reset-button:hover {
          background: #c0392b;
        }
      `}</style>
    </div>
  );
};

export default AppSettings;