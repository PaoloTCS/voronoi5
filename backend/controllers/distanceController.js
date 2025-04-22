const { cosineDistance } = require('../utils/mathUtils');

const calculateDistance = async (req, res) => {
  try {
    const { text1, text2 } = req.body;
    const embeddingsService = req.embeddings; // Access embeddings from middleware

    if (!text1 || !text2) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: text1 or text2"
      });
    }

    if (!embeddingsService || typeof embeddingsService.embedDocuments !== 'function') {
        console.error("Embeddings service not available or invalid in request object.");
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error: Embeddings service configuration issue." 
        });
    }

    console.log("Generating embeddings for distance calculation...");
    // Generate embeddings for both texts
    // Note: embedDocuments expects an array of strings
    const embeddings = await embeddingsService.embedDocuments([text1, text2]);

    if (!embeddings || embeddings.length !== 2 || !embeddings[0] || !embeddings[1]) {
        throw new Error("Failed to generate embeddings for one or both texts.");
    }
    
    const embedding1 = embeddings[0];
    const embedding2 = embeddings[1];

    // console.log(`Embedding 1 length: ${embedding1.length}, Embedding 2 length: ${embedding2.length}`); // Diagnostic

    // Calculate cosine distance
    const distance = cosineDistance(embedding1, embedding2);
    console.log(`Calculated distance: ${distance}`);

    res.json({
      success: true,
      distance: distance,
      // Optionally return truncated embeddings if needed for debugging/display
      // embedding1_preview: embedding1.slice(0, 5), 
      // embedding2_preview: embedding2.slice(0, 5)
    });

  } catch (error) {
    console.error("Distance calculation failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate distance",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = {
  calculateDistance,
}; 