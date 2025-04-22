const { Pinecone } = require('@pinecone-database/pinecone');
const { UMAP } = require('umap-js');

// Initialize Pinecone client 
// Note: Consider passing initialized clients (Pinecone, models) via request context
//       instead of re-initializing here, if performance becomes an issue.
let pinecone = null;
if (process.env.PINECONE_API_KEY) {
    try {
        pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        console.log("Pinecone client initialized in analysisController.");
    } catch (e) {
        console.error("Failed to initialize Pinecone in analysisController:", e);
        pinecone = null;
    }
} else {
    console.error("PINECONE_API_KEY environment variable not found for analysisController!");
}

/**
 * Fetches vectors for 3 items (docs or external papers) and performs 2D UMAP reduction.
 */
exports.getTriangle2D = async (req, res) => {
    const { itemIds } = req.body; 

    if (!pinecone) {
        return res.status(500).json({ success: false, message: "Database service not available." });
    }
    if (!Array.isArray(itemIds) || itemIds.length !== 3) {
        return res.status(400).json({ success: false, message: "Exactly 3 item IDs are required." });
    }

    try {
        const index = pinecone.index(process.env.PINECONE_INDEX);

        const pineconeFetchMap = {};
        const pineconeVectorIds = [];
        const originalItemIdsInOrder = []; // Keep track of original IDs for the response

        for (const itemId of itemIds) {
            const parts = itemId.split('::');
            if (parts.length !== 2) {
                 return res.status(400).json({ success: false, message: `Invalid item ID format: ${itemId}` });
            }
            const type = parts[0];
            const originalId = parts[1];
            
            if (type === 'doc') {
                // Use the confirmed format for uploaded docs (first chunk only)
                const pineconeId = `${originalId}-0`; 
                pineconeVectorIds.push(pineconeId);
                pineconeFetchMap[pineconeId] = itemId;
                originalItemIdsInOrder.push(itemId);
            } else if (type === 'ext') {
                // External papers are not supported yet
                console.warn(`Analysis requested for external paper (${itemId}), which is not yet supported.`);
                return res.status(400).json({ 
                    success: false, 
                    message: `Analysis for external papers (like "${originalId}") is not yet supported. Please select only uploaded documents.` 
                });
            } else {
                 return res.status(400).json({ success: false, message: `Unknown item type in ID: ${itemId}` });
            }
        }
        
        // Should have exactly 3 document vector IDs now
        if (pineconeVectorIds.length !== 3) {
             return res.status(500).json({ success: false, message: "Internal error: Failed to prepare vector IDs for fetching." });
        }

        console.log(`Fetching vectors for Pinecone IDs: ${pineconeVectorIds.join(', ')}`);
        const fetchResponse = await index.fetch(pineconeVectorIds);
        
        const vectors = [];
        const missingIds = [];
        for (const pineconeId of pineconeVectorIds) {
             if (fetchResponse.records[pineconeId]) {
                vectors.push(fetchResponse.records[pineconeId].values);
            } else {
                console.error(`Vector not found for Pinecone ID: ${pineconeId}`);
                const originalItemId = pineconeFetchMap[pineconeId]; 
                missingIds.push(originalItemId);
            }
        }

        if (missingIds.length > 0) {
            // Include the specific missing doc name in the error
            const missingDocNames = missingIds.map(id => id.split('::')[1]);
            return res.status(404).json({ success: false, message: `Vector data not found for document(s): ${missingDocNames.join(', ')}. Ensure they have been processed.` });
        }
        // No need to check vectors.length again, already implicitly checked by missingIds
        
        console.log(`Retrieved ${vectors.length} vectors. Performing UMAP...`);
        // Log the first element of each input vector for comparison
        console.log("Input Vectors (first element):");
        vectors.forEach((v, i) => console.log(`  Vector ${i}: ${v[0]}`));

        // Perform UMAP reduction
        const umap = new UMAP({
            nComponents: 2,
            nNeighbors: 1, // Try nNeighbors = 1
            minDist: 0.1,
            spread: 1.0,
            randomState: 42, // Add fixed random seed for deterministic output
            init: 'spectral' // Add spectral initialization
        });

        const embedding2d = umap.fit(vectors);
        console.log("UMAP completed.");
        // Log the output coordinates
        console.log("Output embedding2d:", embedding2d);

        // Format response using original item IDs (which are all doc:: type now)
        const coordinates = originalItemIdsInOrder.map((itemId, index) => ({
            id: itemId, 
            x: embedding2d[index][0],
            y: embedding2d[index][1],
        }));

        console.log("Formatted Coordinates for Response:", coordinates);
        res.json({ success: true, coordinates });

    } catch (error) {
        console.error("Error in getTriangle2D analysis:", error);
        res.status(500).json({
            success: false,
            message: "Failed to perform 2D triangle analysis",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
        });
    }
};

const analyzePoint = async (req, res) => {
    const { contributions } = req.body; // Array of { id, title, weight, similarity }

    if (!contributions || !Array.isArray(contributions) || contributions.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid contributions data provided.' });
    }

    if (!req.model) {
        console.error("LLM model not available in request object.");
        return res.status(500).json({ success: false, message: 'LLM model not initialized on the server.' });
    }

    try {
        // --- Construct the Prompt ---
        // Sort contributions by weight (descending) to highlight the most influential
        const sortedContributions = [...contributions].sort((a, b) => b.weight - a.weight);

        let prompt = `Analyze the semantic meaning of a point within a conceptual space defined by the following documents and their contribution weights:\n\n`;

        sortedContributions.forEach(c => {
            // Escape any backticks or ${} sequences in titles if necessary, though unlikely for titles
            const cleanTitle = c.title.replace(/[`$]/g, ''); // Basic escaping
            prompt += `- ${cleanTitle}: ${Math.round(c.weight * 100)}% contribution\n`;
        });

        prompt += `
Describe what conceptual topic or idea this specific blend represents. Focus on the *combination* of topics rather than just listing the documents. Be concise (2-3 sentences).`;

        console.log("Sending prompt to LLM:\n", prompt);

        // --- Call the LLM ---
        // Ensure req.model.invoke returns a string or object with a string property
        const llmResult = await req.model.invoke(prompt);
        
        // Extract the actual text response - this might need adjustment based on your LLM wrapper
        const analysisText = (typeof llmResult === 'string') ? llmResult : llmResult.content || JSON.stringify(llmResult);

        console.log("Received LLM response object:", llmResult);
        console.log("Extracted analysis text:", analysisText);

        // --- Send Response ---
        res.json({ success: true, analysis: analysisText });

    } catch (error) {
        console.error('Error during LLM analysis:', error);
        // Check if the error has a specific message from the LLM or network
        const errorMessage = error.response?.data?.message || error.message || 'Failed to generate analysis from LLM.';
        res.status(500).json({ success: false, message: errorMessage });
    }
};

module.exports = {
    getTriangle2D: exports.getTriangle2D,
    analyzePoint,
}; 