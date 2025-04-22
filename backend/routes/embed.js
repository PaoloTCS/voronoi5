const express = require('express');
const router = express.Router();

// POST /api/embed
router.post('/embed', async (req, res) => {
  const { documents } = req.body; // Expecting { documents: [{ id: 'doc1', content: '...' }, ...] }
  const embeddingsClient = req.embeddings; // Get client initialized in server.js

  if (!documents || !Array.isArray(documents) || documents.length === 0) {
    return res.status(400).json({ success: false, message: 'Missing or invalid documents array in request body.' });
  }

  if (!embeddingsClient) {
    console.error("Embeddings client not found on request object.");
    return res.status(500).json({ success: false, message: 'Embeddings client not initialized.' });
  }

  console.log(`Received request to embed ${documents.length} documents.`);

  try {
    const results_2d = {};
    const results_3d = {};
    const results_embeddings = {}; // Add object to store embeddings

    for (const doc of documents) {
      if (!doc.id || !doc.content) {
        console.warn(`Skipping document with missing id or content:`, doc);
        continue; // Skip incomplete documents
      }
      try {
        const embedding = await embeddingsClient.embedQuery(doc.content);

        // --- Improved (but still basic) projection ---
        let coord_2d = [0, 0];
        let coord_3d = [0, 0, 0];

        if (embedding && embedding.length > 0) {
            // Example: Sum slices for more variance
            // Adjust slice sizes based on embedding dimensions (e.g., 1024 for text-embedding-3-small)
            const sliceSize = Math.floor(embedding.length / 10); // e.g., 102 for 1024 dims
            
            if (sliceSize > 0) {
                const sumSlice = (start, end) => embedding.slice(start, end).reduce((a, b) => a + b, 0);
                
                // Ensure slices don't go out of bounds
                const end1 = sliceSize;
                const end2 = Math.min(embedding.length, sliceSize * 2);
                const end3 = Math.min(embedding.length, sliceSize * 3);
                
                // Use sums of different slices for coordinates
                coord_2d = [sumSlice(0, end1), sumSlice(end1, end2)];
                coord_3d = [sumSlice(0, end1), sumSlice(end1, end2), sumSlice(end2, end3)];
            } else {
                // Fallback if embedding is too small for slicing
                coord_2d = embedding.length >= 2 ? [embedding[0], embedding[1]] : [0, 0];
                coord_3d = embedding.length >= 3 ? [embedding[0], embedding[1], embedding[2]] : [0, 0, 0];
            }
        }
        // --- End Improved Projection ---

        results_2d[doc.id] = coord_2d;
        results_3d[doc.id] = coord_3d;
        results_embeddings[doc.id] = embedding; // Store the full embedding

        // Optional: Log partial success
        // console.log(`Successfully embedded document: ${doc.id}`);

      } catch (embedError) {
        console.error(`Failed to embed document ${doc.id}:`, embedError);
        // Decide if we want to skip or fail the whole request
        // For now, we'll skip and continue, but won't include it in results
      }
    }

    console.log(`Finished embedding. Returning coordinates and embeddings for ${Object.keys(results_2d).length} documents.`);
    res.json({
      success: true,
      coordinates_2d: results_2d,
      coordinates_3d: results_3d,
      embeddings: results_embeddings // Include embeddings in the response
    });

  } catch (error) {
    console.error('Error processing /api/embed request:', error);
    res.status(500).json({ success: false, message: 'Internal server error during embedding.' });
  }
});

module.exports = router; 