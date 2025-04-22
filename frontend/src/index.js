import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { validateEnv, formatValidationMessage } from './utils/envValidation';

// Validate environment variables
const envValidation = validateEnv();
if (!envValidation.isValid) {
  console.error('Environment validation failed:');
  console.error(formatValidationMessage(envValidation));
  
  // If in development, show a more visible warning
  if (process.env.NODE_ENV === 'development') {
    displayEnvironmentWarning(formatValidationMessage(envValidation));
  }
}

function displayEnvironmentWarning(message) {
  const warningDiv = document.createElement('div');
  warningDiv.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    max-width: 400px;
    padding: 15px;
    background-color: #fff3cd;
    color: #856404;
    border: 1px solid #ffeeba;
    border-radius: 4px;
    z-index: 1000;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  warningDiv.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center">
      <div>${message}</div>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: none;
        border: none;
        color: #856404;
        cursor: pointer;
        font-size: 20px;
        padding: 0 0 0 10px;
      ">×</button>
    </div>
  `;
  document.body.appendChild(warningDiv);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);