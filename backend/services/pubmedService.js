const axios = require('axios');

// Base URL for NCBI E-utilities
const EUTILS_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

/**
 * Fetches article IDs from PubMed based on keywords.
 * @param {string[]} keywords - Array of keywords.
 * @param {number} maxResults - Maximum number of IDs to fetch.
 * @returns {Promise<string[]>} - Promise resolving to an array of PubMed IDs (PMIDs).
 */
async function searchPubMedIds(keywords, maxResults = 10) {
    const queryTerm = keywords.join(' AND '); // Combine keywords
    const searchUrl = `${EUTILS_BASE_URL}/esearch.fcgi`;

    try {
        console.log(`[pubmedService] Searching PubMed with term: "${queryTerm}", max: ${maxResults}`);
        const response = await axios.get(searchUrl, {
            params: {
                db: 'pubmed',
                term: queryTerm,
                retmode: 'json',
                retmax: maxResults,
                sort: 'relevance' // Or 'pub+date' for most recent
            }
        });

        if (response.data && response.data.esearchresult && response.data.esearchresult.idlist) {
            const ids = response.data.esearchresult.idlist;
            console.log(`[pubmedService] Found ${ids.length} PubMed IDs.`);
            return ids;
        } else {
            console.warn('[pubmedService] No PubMed IDs found or unexpected response format.');
            return [];
        }
    } catch (error) {
        console.error('[pubmedService] Error searching PubMed IDs:', error.response ? error.response.data : error.message);
        throw new Error('Failed to search PubMed IDs.');
    }
}

/**
 * Fetches summary details for given PubMed IDs.
 * @param {string[]} ids - Array of PubMed IDs (PMIDs).
 * @returns {Promise<object[]>} - Promise resolving to an array of formatted article objects.
 */
async function fetchPubMedSummaries(ids) {
    if (!ids || ids.length === 0) {
        return [];
    }

    const summaryUrl = `${EUTILS_BASE_URL}/esummary.fcgi`;
    const idString = ids.join(',');

    try {
        console.log(`[pubmedService] Fetching summaries for ${ids.length} PubMed IDs.`);
        const response = await axios.get(summaryUrl, {
            params: {
                db: 'pubmed',
                id: idString,
                retmode: 'json'
            }
        });

        if (response.data && response.data.result) {
            const results = response.data.result;
            const articles = Object.keys(results)
                .filter(key => key !== 'uids') // Filter out the 'uids' key
                .map(id => {
                    const item = results[id];
                    // Basic structure mapping - may need refinement based on actual data
                    return {
                        id: item.uid, // Use PMID as ID
                        title: item.title || '[No Title]',
                        summary: item.abstract || '[No Abstract Available]', // Abstract might not always be present
                        link: `https://pubmed.ncbi.nlm.nih.gov/${item.uid}/`,
                        authors: item.authors ? item.authors.map(author => author.name) : [],
                        published: item.pubdate ? new Date(item.pubdate).toISOString() : null // Attempt to parse date
                    };
                });
            console.log(`[pubmedService] Formatted ${articles.length} articles.`);
            return articles;
        } else {
            console.warn('[pubmedService] No PubMed summaries found or unexpected response format.');
            return [];
        }
    } catch (error) {
        console.error('[pubmedService] Error fetching PubMed summaries:', error.response ? error.response.data : error.message);
        throw new Error('Failed to fetch PubMed summaries.');
    }
}

/**
 * Main function to fetch data from PubMed.
 * @param {object} options - Options object containing keywords and maxResults.
 * @returns {Promise<object[]>} - Promise resolving to an array of formatted article objects.
 */
async function fetchData(options) {
    console.log('[pubmedService] Fetching data with options:', options);
    const { keywords, maxResults } = options;

    if (!keywords || keywords.length === 0) {
        throw new Error('Keywords are required for PubMed search.');
    }

    try {
        const ids = await searchPubMedIds(keywords, maxResults);
        if (ids.length === 0) {
            return [];
        }
        const articles = await fetchPubMedSummaries(ids);
        return articles;
    } catch (error) {
        // Log the error origin if possible
        console.error('[pubmedService] Error in fetchData:', error.message);
        // Re-throw a more generic error or handle as needed
        throw new Error(`PubMed service failed: ${error.message}`);
    }
}

module.exports = {
    fetchData
}; 