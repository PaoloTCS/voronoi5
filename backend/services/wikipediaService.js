// Placeholder for Wikipedia MediaWiki API interaction
const axios = require('axios'); // We'll likely need axios

// Base URL for Wikipedia API
const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';

/**
 * Fetches Wikipedia page IDs and titles based on keywords.
 * @param {string[]} keywords - Array of keywords.
 * @param {number} maxResults - Maximum number of results.
 * @returns {Promise<object[]>} - Promise resolving to an array of { pageid, title }.
 */
async function searchWikipediaPages(keywords, maxResults = 10) {
    const searchTerm = keywords.join(' '); // Combine keywords for search
    console.log(`[wikipediaService] Searching Wikipedia with term: "${searchTerm}", max: ${maxResults}`);

    try {
        const response = await axios.get(WIKIPEDIA_API_URL, {
            params: {
                action: 'query',
                list: 'search',
                srsearch: searchTerm,
                srlimit: maxResults,
                format: 'json'
            }
        });

        if (response.data && response.data.query && response.data.query.search) {
            const searchResults = response.data.query.search.map(item => ({ 
                pageid: item.pageid, 
                title: item.title 
            }));
            console.log(`[wikipediaService] Found ${searchResults.length} potential Wikipedia pages.`);
            return searchResults;
        } else {
            console.warn('[wikipediaService] No Wikipedia pages found or unexpected search response format.');
            return [];
        }
    } catch (error) {
        console.error('[wikipediaService] Error searching Wikipedia pages:', error.response ? error.response.data : error.message);
        throw new Error('Failed to search Wikipedia pages.');
    }
}

/**
 * Fetches summaries (extracts) for given Wikipedia page IDs.
 * @param {number[]} pageids - Array of Wikipedia page IDs.
 * @returns {Promise<object[]>} - Promise resolving to an array of formatted article objects.
 */
async function fetchWikipediaSummaries(pageids) {
    if (!pageids || pageids.length === 0) {
        return [];
    }

    console.log(`[wikipediaService] Fetching summaries for ${pageids.length} Wikipedia page IDs.`);
    try {
        const response = await axios.get(WIKIPEDIA_API_URL, {
            params: {
                action: 'query',
                pageids: pageids.join('|'), // Use pipe separator for multiple IDs
                prop: 'extracts|info',      // Get extracts and page URL info
                inprop: 'url',             // Include the full URL
                exintro: true,             // Get only the introductory section
                explaintext: true,         // Get plain text instead of HTML
                exsentences: 5,            // Limit extract length (approx)
                format: 'json'
            }
        });

        if (response.data && response.data.query && response.data.query.pages) {
            const pages = response.data.query.pages;
            const articles = Object.values(pages).map(page => {
                // Basic structure mapping
                return {
                    id: page.pageid,
                    title: page.title || '[No Title]',
                    summary: page.extract || '[No Summary Available]',
                    link: page.fullurl || `https://en.wikipedia.org/?curid=${page.pageid}`,
                    authors: ['Wikipedia Contributors'], // Standard attribution
                    published: page.touched ? new Date(page.touched).toISOString() : null // Use last touched date
                };
            });
            console.log(`[wikipediaService] Formatted ${articles.length} Wikipedia articles.`);
            return articles;
        } else {
            console.warn('[wikipediaService] No Wikipedia summaries found or unexpected query response format.');
            return [];
        }
    } catch (error) {
        console.error('[wikipediaService] Error fetching Wikipedia summaries:', error.response ? error.response.data : error.message);
        throw new Error('Failed to fetch Wikipedia summaries.');
    }
}

/**
 * Main function to fetch data from Wikipedia.
 * @param {object} options - Options object containing keywords and maxResults.
 * @returns {Promise<object[]>} - Promise resolving to an array of formatted article objects.
 */
async function fetchData(options) {
    console.log('[wikipediaService] Fetching data with options:', options);
    const { keywords, maxResults } = options;

    if (!keywords || keywords.length === 0) {
        throw new Error('Keywords are required for Wikipedia search.');
    }

    try {
        const pages = await searchWikipediaPages(keywords, maxResults);
        if (pages.length === 0) {
            return [];
        }
        const pageids = pages.map(p => p.pageid);
        const articles = await fetchWikipediaSummaries(pageids);
        return articles;
    } catch (error) {
        console.error('[wikipediaService] Error in fetchData:', error.message);
        throw new Error(`Wikipedia service failed: ${error.message}`);
    }
}

module.exports = {
    fetchData
}; 