// frontend/src/App.js - Updated to remove the sidebar
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { DomainProvider, useDomains } from './context/DomainContext';
import VoronoiDiagram from './components/VoronoiDiagram';
import Breadcrumbs from './components/Breadcrumbs';
import DomainPanel from './components/DomainPanel';
import AppSettings from './components/AppSettings';
import SplashPage from './components/SplashPage';
import AnalysisPage from './components/AnalysisPage';
import SemanticTriangulationDemo from './components/SemanticTriangulationDemo';
import TetrahedronDemo from './components/TetrahedronDemo';
import { saveDomainState, clearDomainState } from './utils/dbService';

// Main application content
const MainAppContent = () => {
  const {
    currentPath,
    getCurrentDomain,
    getCurrentDomains,
    getCurrentDocuments,
    navigateTo,
    selectDomain,
    addSubdomain,
    addDocument,
    config,
    setConfig,
    resetData,
    setInitialDomains,
    domains,
    isInitialized,
    addDomain
  } = useDomains();
  
  // New state to track if setup is complete
  const [setupComplete, setSetupComplete] = useState(false);
  
  // Check if setup is complete based on domains existence
  useEffect(() => {
    if (isInitialized) {
      const hasDomains = domains.items && domains.items.length > 0;
      setSetupComplete(hasDomains);
    }
  }, [isInitialized, domains.items]);
  
  // Show loading until initialization is complete
  if (!isInitialized) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div>Loading your domain data...</div>
        <style jsx="true">{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          }
          
          .loading-spinner {
            border: 4px solid rgba(0, 0, 0, 0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #3498db;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
  
  // Handler for completing setup
  const handleSetupComplete = async (interests) => {
    // First, set the domains
    setInitialDomains(interests);
    
    // Then mark setup as complete by saving to db
    setSetupComplete(true);
    
    // Force immediate save to database
    const stateToSave = {
      domains: { items: interests, children: {} },
      documents: {},
      config: { maxDepth: config.maxDepth }
    };
    
    try {
      const success = await saveDomainState(stateToSave);
      if (!success) {
        console.error('Failed to save initial domains');
        // If save fails, reset the state
        await resetData();
        window.location.reload();
      }
    } catch (error) {
      console.error('Error saving initial state:', error);
      // If save fails, reset the state
      await resetData();
      window.location.reload();
    }
  };
  
  // Handler for document upload
  const handleDocumentUpload = (name, content) => {
    addDocument(name, content);
  };
  
  // Handler for changing maximum depth
  const handleChangeMaxDepth = (maxDepth) => {
    setConfig({ maxDepth });
  };
  
  // Handler for reset
  const handleReset = async () => {
    try {
      // First clear the state from IndexedDB
      await clearDomainState();
      // Then reset the state
      await resetData();
      // Force reloading the page to ensure clean state
      window.location.reload();
    } catch (error) {
      console.error('Error resetting state:', error);
      // If reset fails, force reload
      window.location.reload();
    }
  };
  
  // Handler for adding a root domain
  const handleAddRootDomain = (domain) => {
    if (domain && domain.trim()) {
      addDomain(domain.trim());
    }
  };
  
  // Show splash page if setup is not complete
  if (!setupComplete) {
    return <SplashPage onStart={handleSetupComplete} />;
  }
  
  // Function to get the currently selected documents
  const getSelectedDocuments = () => {
    const docs = getCurrentDocuments() || [];
    const selectedDocs = docs.filter(doc => doc.selected === true);
    return selectedDocs;
  };
  
  return (
    <div className="app">
      <header className="app-header">
        <h1>Semantic Voronoi Tessellation</h1>
        <div className="header-controls">
          <Link 
            to="/semantic-triangulation" 
            state={{ 
              path: currentPath,
              selectedDocs: getSelectedDocuments() 
            }} 
            className="nav-button"
          >
            Semantic Triangulation
          </Link>
          <Link 
            to="/3d-tetrahedron" 
            state={{ 
              path: currentPath,
              selectedDocs: getSelectedDocuments() 
            }} 
            className="nav-button"
          >
            3D Tetrahedron
          </Link>
          <button 
            className="restart-button" 
            onClick={handleReset}
          >
            Start Over
          </button>
          <AppSettings 
            maxDepth={config.maxDepth}
            onChangeMaxDepth={handleChangeMaxDepth}
            onReset={handleReset}
          />
        </div>
      </header>
      
      <Breadcrumbs 
        path={currentPath} 
        onNavigate={navigateTo} 
      />
      
      <div className="main-content">
        <VoronoiDiagram 
          domains={getCurrentDomains()} 
          onDomainSelect={selectDomain}
          currentPath={currentPath}
        />
        
        <DomainPanel
          currentDomain={getCurrentDomain()}
          currentPath={currentPath}
          onAddSubdomain={addSubdomain}
          onAddRootDomain={handleAddRootDomain}
          onDocumentUpload={handleDocumentUpload}
          onDomainSelect={selectDomain}
          documents={getCurrentDocuments()}
          maxDepth={config.maxDepth}
          isRootLevel={currentPath.length === 0}
        />
      </div>
      
      <style jsx="true">{`
        .app {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .app-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .header-controls {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        
        h1 {
          color: #2c3e50;
          margin: 0;
        }
        
        .restart-button {
          background: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }
        
        .restart-button:hover {
          background: #e9ecef;
        }
        
        .nav-button {
          background: #4a90e2;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 14px;
          text-decoration: none;
          transition: background-color 0.2s;
        }
        
        .nav-button:hover {
          background: #3a7bcb;
        }
        
        .main-content {
          display: flex;
          gap: 20px;
          margin-top: 20px;
        }
        
        @media (max-width: 992px) {
          .app-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .header-controls {
            margin-top: 10px;
            width: 100%;
            justify-content: flex-end;
          }
          
          .main-content {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

// Root App component with provider
function App() {
  return (
    <Router>
      <DomainProvider>
        <Routes>
          <Route path="/" element={<MainAppContent />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/analyze-triangle" element={<AnalysisPage />} />
          <Route path="/semantic-triangulation" element={<SemanticTriangulationDemo />} />
          <Route path="/3d-tetrahedron" element={<TetrahedronDemo />} />
        </Routes>
      </DomainProvider>
    </Router>
  );
}

export default App;