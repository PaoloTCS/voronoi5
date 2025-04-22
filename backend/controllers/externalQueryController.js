const arxivService = require('../services/arxivService');
const pubmedService = require('../services/pubmedService'); // Import new service
const wikipediaService = require('../services/wikipediaService'); // Import new service
const { HumanMessage } = require('@langchain/core/messages'); // Import HumanMessage

async function getExternalResources(req, res) { // Renamed function for clarity
    try {
        // Get the model instance from the request object (attached by middleware)
        const model = req.model;
        if (!model) {
            console.error('LLM model instance not found on request object.');
            return res.status(500).json({ message: 'Server configuration error: LLM model not available.'});
        }

        // --- Extract query parameters --- 
        const { 
            context, 
            keywords: userKeywords, 
            maxResults, 
            source: requestedSource, // Source selected by user
            fromDate,
            toDate 
        } = req.query;
        // ------------------------------

        let searchKeywords = [];
        let determinedSource = 'arxiv'; // Default

        if (!context && !userKeywords) {
             // Require either context or keywords
             return res.status(400).json({ message: 'Query parameter \'context\' or \'keywords\' is required.' });
        }

        // --- Determine Source and Keywords --- 
        const validSources = ['arxiv', 'pubmed', 'wikipedia', 'oxfordmusic', 'mgg', 'rilm', 'jstor', 'projectmuse']; // Add valid sources

        if (requestedSource && requestedSource !== 'auto' && validSources.includes(requestedSource.toLowerCase())) {
            // 1. User specified a valid source - use it directly
            determinedSource = requestedSource.toLowerCase();
            console.log(`Using user-specified source: ${determinedSource}`);
            
            // --- Derive keyword from LAST path segment or user keywords --- 
            searchKeywords = [];
            if (context) {
                // Extract the last part of the context string (e.g., "Physics" from "Science > Physics")
                const pathSegments = context.split(' > ');
                const lastSegment = pathSegments[pathSegments.length - 1]?.trim();
                if (lastSegment) {
                    searchKeywords.push(lastSegment);
                    console.log(`Using last path segment as keyword: "${lastSegment}"`);
                }
            } 
            if (userKeywords) {
                 const userKeywordsList = userKeywords.split(',').map(kw => kw.trim()).filter(kw => kw.length > 0);
                 // Prepend user keywords if they exist, and ensure uniqueness if context keyword also exists
                 searchKeywords = [...new Set([...userKeywordsList, ...searchKeywords])]; 
            } 
            // If no keyword derived from context or user, this will be empty (and handled later)
            // ------------------------------------------------------------

            console.log('Using derived/user keywords for specified source:', searchKeywords);

        } else {
            // 2. Source is 'auto' or invalid/missing - use LLM to suggest source and keywords (existing logic)
            if (!context) {
                return res.status(400).json({ message: 'Query parameter \'context\' is required when source is set to \'auto\' or not specified.' });
            }
            console.log(`Auto-determining source and keywords for context: "${context}"`);
            try {
                const prompt = new HumanMessage(
                    `Based on the topic "${context}", first suggest the single most relevant information source (choose ONLY from: arXiv, PubMed, Wikipedia) and then generate 1-3 concise search keywords suitable for querying that source. 
                    Output format MUST be: Source: [Chosen Source]\nKeywords: [keyword1, keyword2, keyword3]`
                );
                const llmResponse = await model.invoke([prompt]);
                const llmOutput = llmResponse.content.trim();
                console.log(`LLM raw response for auto source/keywords: "${llmOutput}"`);

                const sourceMatch = llmOutput.match(/^Source:\s*(arXiv|PubMed|Wikipedia)/im);
                const keywordsMatch = llmOutput.match(/Keywords:\s*(.*)$/im);

                if (sourceMatch && sourceMatch[1]) {
                    determinedSource = sourceMatch[1].toLowerCase();
                    console.log(`LLM suggested source: ${determinedSource}`);
                } else {
                    console.warn('LLM did not return a valid source. Defaulting to arXiv.');
                    determinedSource = 'arxiv';
                }

                if (keywordsMatch && keywordsMatch[1]) {
                    searchKeywords = keywordsMatch[1].split(',').map(kw => kw.trim()).filter(kw => kw.length > 0);
                    console.log('Using LLM-generated keywords:', searchKeywords);
                } else {
                    console.warn('LLM did not return usable keywords. Falling back to context words.');
                    searchKeywords = context.split(/[>\s,]+/).map(kw => kw.trim()).filter(kw => kw.length > 0);
                }

            } catch (llmError) {
                console.error('Error calling LLM for auto source/keyword generation:', llmError);
                console.warn('LLM call failed. Falling back to context words for arXiv search.');
                searchKeywords = context.split(/[>\s,]+/).map(kw => kw.trim()).filter(kw => kw.length > 0);
                determinedSource = 'arxiv';
            }
            // Merge user keywords if provided in auto mode
            if (userKeywords) {
                 const userKeywordsList = userKeywords.split(',').map(kw => kw.trim()).filter(kw => kw.length > 0);
                 searchKeywords = searchKeywords.length > 0 ? [...new Set([...searchKeywords, ...userKeywordsList])] : userKeywordsList;
            }
        }
        // -------------------------------------

        if (searchKeywords.length === 0) {
             return res.status(400).json({ message: 'Could not derive valid keywords from context or input.' });
        }

        // --- Prepare options, including dates --- 
        const options = {
            keywords: searchKeywords,
            maxResults: maxResults ? parseInt(maxResults, 10) : undefined,
            fromDate: fromDate || undefined, // Add dates if provided
            toDate: toDate || undefined
        };
        // --------------------------------------

        let results = [];
        let actualSource = determinedSource; // Track which source is actually used

        console.log(`Routing request to source: ${determinedSource} with options:`, options);

        // --- Route to the appropriate service --- 
        try {
            // Extend routing based on determinedSource
            if (determinedSource === 'pubmed') {
                results = await pubmedService.fetchData(options);
            } else if (determinedSource === 'wikipedia') {
                results = await wikipediaService.fetchData(options);
            } 
            // Add placeholders for new sources (implement actual services later)
            else if (determinedSource === 'oxfordmusic' || determinedSource === 'mgg' || determinedSource === 'rilm' || determinedSource === 'jstor' || determinedSource === 'projectmuse') {
                 console.warn(`Service for source '${determinedSource}' is not yet implemented. Returning empty results.`);
                 results = [];
                 // In a real implementation, call the specific service here:
                 // E.g., results = await oxfordMusicService.fetchData(options);
            }
            else { // Default to arXiv
                actualSource = 'arxiv'; // Ensure source is marked as arxiv if defaulting
                results = await arxivService.fetchPapers(options);
            }
        } catch (serviceError) {
            console.error(`Error fetching data from ${determinedSource} service:`, serviceError);
             return res.status(500).json({ 
                 message: `Failed to fetch data from ${determinedSource}.`, 
                 error: serviceError.message 
             });
        }
        // ---------------------------------------

        console.log(`Fetched ${results.length} results from ${actualSource}`);

        res.status(200).json({ 
            source: actualSource, // Return the source that was actually queried
            results: results 
        });

    } catch (error) {
        // General catch-all for errors not caught elsewhere
        console.error('Error in getExternalResources controller:', error);
        if (!res.headersSent) {
           res.status(500).json({ message: 'An unexpected server error occurred.', error: error.message });
        }
    }
}

module.exports = {
    getExternalResources
}; 