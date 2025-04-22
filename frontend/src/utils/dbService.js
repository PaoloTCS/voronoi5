import { openDB } from 'idb';

const DB_NAME = 'voronoiDB';
const DB_VERSION = 1;
const DOMAIN_STORE = 'domainState';

// Initialize the database
async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create a store for domain state if it doesn't exist
      if (!db.objectStoreNames.contains(DOMAIN_STORE)) {
        db.createObjectStore(DOMAIN_STORE);
      }
    },
  });
}

// Save the domain state
export async function saveDomainState(state) {
  try {
    const db = await initDB();
    await db.put(DOMAIN_STORE, state, 'currentState');
    console.log('Domain state saved to IndexedDB');
    return true;
  } catch (error) {
    console.error('Error saving domain state to IndexedDB:', error);
    return false;
  }
}

// Load the domain state
export async function loadDomainState() {
  try {
    const db = await initDB();
    const state = await db.get(DOMAIN_STORE, 'currentState');
    console.log('Domain state loaded from IndexedDB:', state);
    return state;
  } catch (error) {
    console.error('Error loading domain state from IndexedDB:', error);
    return null;
  }
}

// Clear all domain data
export async function clearDomainState() {
  try {
    const db = await initDB();
    await db.delete(DOMAIN_STORE, 'currentState');
    console.log('Domain state cleared from IndexedDB');
    return true;
  } catch (error) {
    console.error('Error clearing domain state from IndexedDB:', error);
    return false;
  }
} 