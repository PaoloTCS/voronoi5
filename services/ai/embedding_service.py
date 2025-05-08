from sentence_transformers import SentenceTransformer
import numpy as np

class EmbeddingService:
    """Handles the generation of text embeddings using a pre-trained model."""

    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        """Initializes the EmbeddingService by loading the specified model."""
        try:
            self.model = SentenceTransformer(model_name)
        except Exception as e:
            # Consider adding more specific error handling or logging
            print(f"Error loading SentenceTransformer model '{model_name}': {e}")
            # Optionally re-raise or handle appropriately (e.g., fall back to a default?)
            raise

    def generate_embedding(self, text: str) -> np.ndarray:
        """Generates an embedding for the given text."""
        if not isinstance(text, str):
            raise TypeError("Input text must be a string.")
        if not text:
            # Return a zero vector or handle empty string case as appropriate
            # Getting dimension from the model
            embedding_dimension = self.model.get_sentence_embedding_dimension()
            return np.zeros(embedding_dimension)
        
        try:
            embedding = self.model.encode(text)
            # The encode method should return a np.ndarray, but check just in case
            if not isinstance(embedding, np.ndarray):
                # This case might indicate an issue with the library version or model
                embedding = np.array(embedding)
            return embedding
        except Exception as e:
            # Handle potential errors during the encoding process
            print(f"Error generating embedding for text: '{text[:50]}...': {e}")
            # Re-raise or return a specific error indicator/value
            raise 