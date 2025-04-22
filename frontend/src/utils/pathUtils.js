// frontend/src/utils/pathUtils.js - Updated
/**
 * Utilities for path manipulation in the domain hierarchy
 */

/**
 * Converts an array path to a string path
 * @param {Array} path - Array of domain names forming a path
 * @returns {String} Path string with '/' as separator
 */
export const arrayToPathString = (path) => {
  if (!path || !Array.isArray(path) || path.length === 0) {
    return '';
  }
  return path.join('/');
};

/**
 * Converts a string path to an array path
 * @param {String} pathString - Path string with '/' as separator
 * @returns {Array} Array of domain names
 */
export const pathStringToArray = (pathString) => {
  if (!pathString || pathString === '') {
    return [];
  }
  return pathString.split('/').filter(Boolean);
};

/**
 * Gets the parent path string from a path array
 * @param {Array} path - Array of domain names forming a path
 * @returns {String} Parent path string
 */
export const getParentPathString = (path) => {
  if (!path || !Array.isArray(path) || path.length <= 1) {
    return '';
  }
  return arrayToPathString(path.slice(0, -1));
};

/**
 * Gets the current domain name from a path array
 * @param {Array} path - Array of domain names forming a path
 * @returns {String|null} Current domain name or null if at root
 */
export const getCurrentDomainFromPath = (path) => {
  if (!path || !Array.isArray(path) || path.length === 0) {
    return null;
  }
  return path[path.length - 1];
};

/**
 * Gets the level (depth) from a path array
 * @param {Array} path - Array of domain names forming a path
 * @returns {Number} Level/depth (0 for root)
 */
export const getLevelFromPath = (path) => {
  if (!path || !Array.isArray(path)) {
    return 0;
  }
  return path.length;
};

/**
 * Creates a human-readable path representation
 * @param {String} pathString - Path string with '/' as separator
 * @returns {String} Human readable path
 * 
 */
export const formatPathForDisplay = (pathString) => {
  if (!pathString || pathString === '') {
    return 'Root Level';
  }
 
  const segments = pathString.split('/').filter(Boolean);
  return segments.join(' > ');
};