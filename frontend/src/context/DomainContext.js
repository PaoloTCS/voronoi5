import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { arrayToPathString, pathStringToArray, getCurrentDomainFromPath } from '../utils/pathUtils';
import { saveDomainState, loadDomainState, clearDomainState } from '../utils/dbService';

// Initial state
const initialState = {
  domains: {
    items: [],  // Empty default array instead of example domains
    children: {}
  },
  currentPath: [],
  documents: {},
  externalPapers: {}, // Add state for external papers metadata
  loading: false,
  error: null,
  config: {
    maxDepth: 10  // Maximum allowed depth for hierarchy
  }
};

// Action types
const ADD_DOMAIN = 'ADD_DOMAIN';
const ADD_SUBDOMAIN = 'ADD_SUBDOMAIN';
const SET_PATH = 'SET_PATH';
const ADD_DOCUMENT = 'ADD_DOCUMENT';
const SET_LOADING = 'SET_LOADING';
const SET_ERROR = 'SET_ERROR';
const SET_CONFIG = 'SET_CONFIG';
const RESET_DATA = 'RESET_DATA';
const SET_INITIAL_DOMAINS = 'SET_INITIAL_DOMAINS';
const CLEAR_DOCUMENTS = 'CLEAR_DOCUMENTS';
const SAVE_EXTERNAL_PAPERS = 'SAVE_EXTERNAL_PAPERS';
const SET_EXTERNAL_PAPERS = 'SET_EXTERNAL_PAPERS'; // Action type for loading

// Reducer function
const domainReducer = (state, action) => {
  switch (action.type) {
    case SET_INITIAL_DOMAINS:
      // Completely replace the initial domains with the provided ones
      return {
        ...state,
        domains: {
          ...state.domains,
          items: action.payload
        }
      };

    case CLEAR_DOCUMENTS:
      return {
        ...state,
        documents: {}
      };

    case ADD_DOMAIN:
      if (state.domains.items.includes(action.payload)) {
        return state; // Don't add duplicates
      }
      return {
        ...state,
        domains: {
          ...state.domains,
          items: [...state.domains.items, action.payload]
        }
      };
    
    case ADD_SUBDOMAIN:
      const { parentPath, subdomain } = action.payload;
      const updatedChildren = { ...state.domains.children };
      
      if (!updatedChildren[parentPath]) {
        updatedChildren[parentPath] = [];
      }
      
      if (!updatedChildren[parentPath].includes(subdomain)) {
        updatedChildren[parentPath] = [...updatedChildren[parentPath], subdomain];
      }
      
      return {
        ...state,
        domains: {
          ...state.domains,
          children: updatedChildren
        }
      };
      
    case SET_PATH:
      return {
        ...state,
        currentPath: action.payload
      };
      
    case ADD_DOCUMENT:
      const { path, document } = action.payload;
      const updatedDocuments = { ...state.documents };
      
      if (!updatedDocuments[path]) {
        updatedDocuments[path] = [];
      }
      
      // Check if document with same name already exists
      const documentExists = updatedDocuments[path].some(
        doc => doc.name === document.name
      );
      
      if (!documentExists) {
        updatedDocuments[path] = [
          ...updatedDocuments[path],
          document
        ];
      }
      
      return {
        ...state,
        documents: updatedDocuments
      };
      
    case SET_LOADING:
      return {
        ...state,
        loading: action.payload
      };
      
    case SET_ERROR:
      return {
        ...state,
        error: action.payload
      };
      
    case SET_CONFIG:
      return {
        ...state,
        config: {
          ...state.config,
          ...action.payload
        }
      };
      
    case RESET_DATA:
      return {
        ...initialState,
        config: state.config, // Preserve user configuration
        domains: {
          items: [],  // Explicitly set to empty array
          children: {}
        }
      };
      
    case SET_EXTERNAL_PAPERS: // Handle loading external papers
        return {
            ...state,
            externalPapers: action.payload || {}
        };

    case SAVE_EXTERNAL_PAPERS: {
      const { path, papers } = action.payload;
      const updatedExternalPapers = { ...state.externalPapers };
      const existingPapers = updatedExternalPapers[path] || [];
      
      // Create a map of existing paper IDs for quick lookup
      const existingIds = new Set(existingPapers.map(p => p.id));
      
      // Filter out papers that already exist in the state for this path
      const newPapersToAdd = papers.filter(p => !existingIds.has(p.id));
      
      if (newPapersToAdd.length > 0) {
        updatedExternalPapers[path] = [...existingPapers, ...newPapersToAdd];
        console.log(`Saved ${newPapersToAdd.length} new external papers for path: ${path}`);
      } else {
        console.log(`No new external papers to save for path: ${path} (already exist).`);
      }
      
      return {
        ...state,
        externalPapers: updatedExternalPapers
      };
    }
      
    default:
      return state;
  }
};

// Create context
const DomainContext = createContext();

// Context provider component
export const DomainProvider = ({ children }) => {
  const [state, dispatch] = useReducer(domainReducer, initialState);
  const [isInitialized, setIsInitialized] = useState(false);
  // --- Add state for selected items ---
  const [selectedItems, setSelectedItems] = useState([]);
  // -----------------------------------
  
  // Load state from IndexedDB on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedState = await loadDomainState();
        
        // Simplified check: Load if any valid saved state exists
        if (savedState) { 
          console.log('Loaded state from IndexedDB:', savedState);
          
          // Restore root domains if they exist
          if (savedState.domains && savedState.domains.items) {
             dispatch({
               type: SET_INITIAL_DOMAINS,
               payload: savedState.domains.items
             });
          }
          
          // Restore subdomains
          if (savedState.domains && savedState.domains.children) {
            Object.keys(savedState.domains.children).forEach(path => {
              savedState.domains.children[path].forEach(subdomain => {
                dispatch({
                  type: ADD_SUBDOMAIN,
                  payload: { parentPath: path, subdomain }
                });
              });
            });
          }
          
          // Restore documents
          if (savedState.documents) {
            Object.keys(savedState.documents).forEach(path => {
              savedState.documents[path].forEach(doc => {
                dispatch({
                  type: ADD_DOCUMENT,
                  payload: { path, document: doc }
                });
              });
            });
          }

          // --- Restore external papers --- 
          if (savedState.externalPapers) {
              dispatch({
                  type: SET_EXTERNAL_PAPERS,
                  payload: savedState.externalPapers
              });
          }
          // -------------------------------
          
          // Restore config
          if (savedState.config) {
            dispatch({
              type: SET_CONFIG,
              payload: savedState.config
            });
          }
        } else {
          console.log('No valid saved state found in IndexedDB, using initial state.');
          // Optionally clear any potentially invalid state if needed
          // await clearDomainState(); 
        }
      } catch (error) {
        console.error('Error loading from IndexedDB:', error);
        dispatch({
          type: SET_ERROR,
          payload: 'Failed to load saved data. Starting with default settings.'
        });
        // Clear potentially corrupted state
        await clearDomainState();
      } finally {
        setIsInitialized(true);
      }
    };
    
    loadData();
  }, []); // Empty dependency array ensures this runs only once on mount
  
  // Save state to IndexedDB on changes
  useEffect(() => {
    if (isInitialized) {
      const stateToSave = {
        domains: state.domains,
        documents: state.documents,
        externalPapers: state.externalPapers, // Include externalPapers in persistence
        config: state.config
      };
      
      saveDomainState(stateToSave)
        .then(success => {
          if (!success) {
            console.warn('Failed to save domain state to IndexedDB');
          }
        });
    }
  }, [state.domains, state.documents, state.externalPapers, state.config, isInitialized]); // Add externalPapers dependency
  
  // Helper functions
  const getPathString = (path = state.currentPath) => {
    return arrayToPathString(path);
  };
  
  const getCurrentDomain = () => {
    return getCurrentDomainFromPath(state.currentPath);
  };
  
  const getCurrentDomains = () => {
    if (state.currentPath.length === 0) {
      return state.domains.items || [];
    } else {
      const parentPath = getPathString();
      return state.domains.children[parentPath] || [];
    }
  };
  
  const getCurrentDocuments = () => {
    const pathString = getPathString();
    return state.documents[pathString] || [];
  };
  
  // Check if a domain already exists at the current path
  const domainExists = (domain) => {
    const currentDomains = getCurrentDomains();
    return currentDomains.includes(domain);
  };
  
  // Check if current depth exceeds maximum allowed depth
  const canAddMoreLevels = () => {
    return state.currentPath.length < state.config.maxDepth;
  };
  
  // Action creators
  const addDomain = (domain) => {
    if (domain && !domainExists(domain)) {
      dispatch({
        type: ADD_DOMAIN,
        payload: domain
      });
    }
  };
  
  const addSubdomain = (subdomain) => {
    if (
      subdomain && 
      getCurrentDomain() && 
      canAddMoreLevels() && 
      !domainExists(subdomain)
    ) {
      const parentPath = getPathString();
      dispatch({
        type: ADD_SUBDOMAIN,
        payload: { parentPath, subdomain }
      });
    }
  };
  
  const setPath = (path) => {
    dispatch({
      type: SET_PATH,
      payload: path
    });
  };
  
  const navigateTo = (level) => {
    if (level === 0) {
      setPath([]);
    } else {
      setPath(state.currentPath.slice(0, level));
    }
  };
  
  const selectDomain = (domain) => {
    setPath([...state.currentPath, domain]);
  };
  
  const addDocument = (name, content) => {
    const path = getPathString();
    dispatch({
      type: ADD_DOCUMENT,
      payload: {
        path,
        document: { name, content }
      }
    });
  };
  
  const setLoading = (loading) => {
    dispatch({
      type: SET_LOADING,
      payload: loading
    });
  };
  
  const setError = (error) => {
    dispatch({
      type: SET_ERROR,
      payload: error
    });
  };
  
  const setConfig = (config) => {
    dispatch({
      type: SET_CONFIG,
      payload: config
    });
  };
  
  const resetData = async () => {
    await clearDomainState();
    dispatch({ type: RESET_DATA });
  };
  
  // New function to set initial domains from splash page
  const setInitialDomains = (domains) => {
    if (Array.isArray(domains) && domains.length >= 3) {
      dispatch({
        type: SET_INITIAL_DOMAINS,
        payload: domains
      });
    } else {
      console.error('Invalid domains array. Must provide at least 3 domains.');
      setError('Invalid domains. Please provide at least 3 domains.');
    }
  };
  
  // --- Function to save external paper metadata ---
  const saveExternalPapers = (path, papers) => {
    if (!path || !papers || papers.length === 0) {
        console.warn('saveExternalPapers called with invalid arguments');
        return;
    }
    dispatch({
        type: SAVE_EXTERNAL_PAPERS,
        payload: { path, papers }
    });
  };
  // ----------------------------------------------

  const value = {
    ...state,
    // --- Expose selection state and setter ---
    selectedItems, 
    setSelectedItems,
    // -----------------------------------------
    // Expose functions through context
    addDomain,
    addSubdomain,
    setPath,
    navigateTo,
    selectDomain,
    addDocument,
    setLoading,
    setError,
    setConfig,
    resetData,
    setInitialDomains,
    clearDocuments: () => dispatch({ type: CLEAR_DOCUMENTS }),
    saveExternalPapers, // Expose the new function
    // Expose helpers
    getPathString,
    getCurrentDomain,
    getCurrentDomains,
    getCurrentDocuments,
    domainExists,
    canAddMoreLevels,
    isInitialized // Expose initialization status
  };

  return (
    <DomainContext.Provider value={value}>
      {children}
    </DomainContext.Provider>
  );
};

// Custom hook to use the domain context
export const useDomains = () => {
  const context = useContext(DomainContext);
  if (context === undefined) {
    throw new Error('useDomains must be used within a DomainProvider');
  }
  return context;
};