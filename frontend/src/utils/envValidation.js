/**
 * Validates required environment variables
 * @returns {Object} Object containing validation results and missing variables
 */
export const validateEnv = () => {
  const requiredVars = {
    REACT_APP_OPENAI_API_KEY: {
      required: true,
      pattern: /^sk-[a-zA-Z0-9_-]{32,}$/,
      message: 'Must be a valid OpenAI API key starting with "sk-"'
    }
  };

  const optionalVars = {
    REACT_APP_API_BASE_URL: {
      pattern: /^https?:\/\/.+/,
      message: 'Must be a valid URL starting with http:// or https://'
    },
    REACT_APP_OPENAI_MODEL: {
      pattern: /^gpt-3\.5-turbo|gpt-4|gpt-4-turbo-preview$/,
      message: 'Must be a valid OpenAI model name'
    }
  };

  const results = {
    isValid: true,
    missing: [],
    invalid: [],
    warnings: []
  };

  // Check required variables
  Object.entries(requiredVars).forEach(([key, config]) => {
    const value = process.env[key];
    
    if (!value) {
      results.isValid = false;
      results.missing.push(key);
    } else if (config.pattern && !config.pattern.test(value)) {
      results.isValid = false;
      results.invalid.push({
        key,
        message: config.message
      });
    }
  });

  // Check optional variables if they exist
  Object.entries(optionalVars).forEach(([key, config]) => {
    const value = process.env[key];
    
    if (value && config.pattern && !config.pattern.test(value)) {
      results.warnings.push({
        key,
        message: config.message
      });
    }
  });

  return results;
};

/**
 * Formats validation results into a readable message
 * @param {Object} results Validation results from validateEnv()
 * @returns {string} Formatted message
 */
export const formatValidationMessage = (results) => {
  const messages = [];

  if (results.missing.length > 0) {
    messages.push('Missing required environment variables:');
    results.missing.forEach(key => {
      messages.push(`  - ${key}`);
    });
  }

  if (results.invalid.length > 0) {
    messages.push('Invalid environment variables:');
    results.invalid.forEach(({ key, message }) => {
      messages.push(`  - ${key}: ${message}`);
    });
  }

  if (results.warnings.length > 0) {
    messages.push('Environment variable warnings:');
    results.warnings.forEach(({ key, message }) => {
      messages.push(`  - ${key}: ${message}`);
    });
  }

  return messages.join('\n');
}; 