const axios = require('axios');
const xml2js = require('xml2js');

const ARXIV_API_URL = 'http://export.arxiv.org/api/query';

/**
 * Fetches papers from arXiv based on search criteria.
 * @param {object} options - Search options.
 * @param {string[]} options.keywords - Keywords to search for (combined with AND).
 * @param {string} [options.startDate] - Start date in YYYYMMDD format.
 * @param {string} [options.endDate] - End date in YYYYMMDD format (defaults to today).
 * @param {number} [options.maxResults=10] - Maximum number of results to return.
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of paper objects.
 */
async function fetchPapers({ keywords, startDate, endDate, maxResults = 10 }) {
    if (!keywords || keywords.length === 0) {
        throw new Error('Keywords are required to search arXiv.');
    }

    // Construct the search query
    // Example query: au:del_maestro+OR+ti:checkerboard
    // Search in all fields for any of the keywords
    const searchQuery = keywords.map(kw => `all:${kw}`).join('+OR+');

    // Date range filtering (Note: arXiv API doesn't have direct date range filtering in the query itself)
    // We will filter after fetching, which is less efficient but the standard way.
    // The API documentation is sparse on date filtering within the query param.
    // We fetch more results and filter afterwards if dates are provided.

    const params = {
        search_query: searchQuery,
        sortBy: 'submittedDate', // Get newest first
        sortOrder: 'descending',
        max_results: startDate || endDate ? 100 : maxResults // Fetch more if filtering by date needed
    };

    try {
        console.log(`Querying arXiv: ${ARXIV_API_URL}?${new URLSearchParams(params).toString()}`);
        const response = await axios.get(ARXIV_API_URL, { params });

        const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
        const result = await parser.parseStringPromise(response.data);

        if (!result.feed || !result.feed.entry) {
            console.log('No entries found in arXiv response.');
            return [];
        }

        let entries = result.feed.entry;
        // Ensure entries is always an array
        if (!Array.isArray(entries)) {
            entries = [entries];
        }

        console.log(`Received ${entries.length} raw entries from arXiv.`);


        // Format and filter entries
        let papers = entries.map(entry => {
            // Author can be a single object or an array
            const authors = Array.isArray(entry.author)
                ? entry.author.map(auth => auth.name)
                : [entry.author?.name].filter(Boolean); // Add check for potentially missing name

            // Safely extract the link
            let paperLink = entry.id; // Default to entry.id (which is the arXiv URL)
            if (entry.link && entry.link.$ && entry.link.$.href) {
                paperLink = entry.link.$.href;
            }

            return {
                id: entry.id,
                title: entry.title?.trim().replace(/\n\s+/g, ' ') || 'No Title', // Add check for title
                authors: authors,
                summary: entry.summary?.trim().replace(/\n\s+/g, ' ') || 'No Summary', // Add check for summary
                published: entry.published,
                updated: entry.updated,
                link: paperLink // Use the safely extracted link
            };
        });

        // Filter by date range if specified
        if (startDate) {
            // Convert YYYYMMDD to Date object for comparison
            const start = new Date(startDate.substring(0, 4), parseInt(startDate.substring(4, 6)) - 1, startDate.substring(6, 8));
            papers = papers.filter(paper => new Date(paper.published) >= start);
            console.log(`Filtered papers by startDate (${startDate}): ${papers.length} remaining.`);

        }
        if (endDate) {
            // Convert YYYYMMDD to Date object for comparison
             // Add 1 day to make the end date inclusive
            const end = new Date(endDate.substring(0, 4), parseInt(endDate.substring(4, 6)) - 1, parseInt(endDate.substring(6, 8)) + 1);
            papers = papers.filter(paper => new Date(paper.published) < end);
             console.log(`Filtered papers by endDate (${endDate}): ${papers.length} remaining.`);
        }

        // Limit results *after* filtering
        return papers.slice(0, maxResults);

    } catch (error) {
        console.error('Error fetching or parsing arXiv data:', error);
        if (error.response) {
            console.error('Axios Response Status:', error.response.status);
            console.error('Axios Response Data:', error.response.data);
        }
        throw new Error('Failed to fetch data from arXiv.');
    }
}

module.exports = {
    fetchPapers
}; 