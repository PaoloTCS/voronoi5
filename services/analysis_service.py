import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from umap import UMAP
from typing import Tuple, List, Optional

class AnalysisService:
    """Provides methods for embedding analysis, including similarity calculation, dimensionality reduction, and nearest neighbor search."""

    def calculate_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Calculates the cosine similarity between two embedding vectors."""
        if emb1.ndim == 1:
            emb1 = emb1.reshape(1, -1)
        if emb2.ndim == 1:
            emb2 = emb2.reshape(1, -1)
        
        if emb1.shape[1] != emb2.shape[1]:
            raise ValueError(f"Embedding dimensions do not match: {emb1.shape[1]} vs {emb2.shape[1]}")

        similarity = cosine_similarity(emb1, emb2)
        # Return the single similarity score (cosine_similarity returns a 2D array)
        return float(similarity[0, 0])

    def reduce_dimensions(self, embeddings: np.ndarray, n_components: int = 2) -> np.ndarray:
        """Reduces the dimensionality of embeddings using UMAP."""
        if not isinstance(embeddings, np.ndarray) or embeddings.ndim != 2:
            raise ValueError("Embeddings must be a 2D numpy array.")
        
        # --- DEBUG ---
        print(f"DEBUG [analysis_service.py]: Received embeddings shape: {embeddings.shape}")
        # --- END DEBUG ---

        n_samples = embeddings.shape[0]
        # UMAP requires at least 3 points for n_neighbors=2, and generally more for good results.
        # Handle cases with very few samples explicitly.
        if n_samples <= 2:
            print(f"Warning: Cannot perform meaningful UMAP with {n_samples} sample(s). Returning zeros.")
            return np.zeros((n_samples, n_components))

        # Adjust n_neighbors based on the number of samples
        if n_samples <= 3: # Force n_neighbors=1 for 3 or fewer samples
             n_neighbors = 1
        elif n_samples <= 15: # For 4 to 15 samples
            n_neighbors = n_samples - 1 # Will be between 3 and 14
        else: # Use default for larger datasets (16+ samples)
            n_neighbors = 15
        
        # --- DEBUG ---
        print(f"DEBUG [analysis_service.py]: Calculated n_samples: {n_samples}, Final n_neighbors: {n_neighbors}") # Updated log message
        # --- END DEBUG ---

        # The check below for n_neighbors <= 1 might not be needed now, 
        # but we leave it as a safeguard/warning.
        if n_neighbors <= 1:
            print(f"Warning: UMAP n_neighbors is {n_neighbors} due to low sample count ({n_samples}). Results might be unstable.")
            # UMAP might handle n_neighbors=1, proceed with caution.

        try:
            reducer = UMAP(
                n_components=n_components,
                n_neighbors=n_neighbors,
                min_dist=0.1,
                random_state=42,
                #metric='cosine' # Often suitable for sentence embeddings
            )
            reduced_embeddings = reducer.fit_transform(embeddings)
            return reduced_embeddings
        except Exception as e:
            print(f"Error during UMAP dimensionality reduction: {e}")
            # Consider returning original embeddings or raising the error
            raise

    def find_k_nearest(
        self, 
        query_emb: np.ndarray, 
        corpus_embeddings: np.ndarray, 
        k: int
    ) -> Tuple[List[int], List[float]]:
        """Finds the k nearest embeddings in the corpus to the query embedding."""
        if query_emb.ndim == 1:
            query_emb = query_emb.reshape(1, -1)
        
        if not isinstance(corpus_embeddings, np.ndarray) or corpus_embeddings.ndim != 2:
            raise ValueError("Corpus embeddings must be a 2D numpy array.")
            
        if query_emb.shape[1] != corpus_embeddings.shape[1]:
            raise ValueError(f"Query and corpus embedding dimensions do not match: {query_emb.shape[1]} vs {corpus_embeddings.shape[1]}")

        # Calculate cosine similarities
        similarities = cosine_similarity(query_emb, corpus_embeddings)[0] # Get the similarity scores for the single query

        # Get the indices of the top k+1 similarities (in case query is in corpus)
        # Argsort sorts in ascending order, so we take the end of the sorted list
        k_adjusted = min(k + 1, len(similarities)) # Adjust k if corpus is smaller than k
        nearest_indices_sorted = np.argsort(similarities)[-k_adjusted:]

        # Exclude the query itself if it's identical (similarity ~1.0)
        # We iterate from most similar (end of list) backwards
        top_k_indices = []
        top_k_scores = []
        for idx in reversed(nearest_indices_sorted):
            # Use a tolerance for floating point comparison
            if not np.isclose(similarities[idx], 1.0, atol=1e-8):
                top_k_indices.append(int(idx))
                top_k_scores.append(float(similarities[idx]))
                if len(top_k_indices) == k:
                    break
            # If the most similar *is* the query (or identical), check the next one

        # If after excluding self, we have fewer than k, take the available ones.
        
        return top_k_indices, top_k_scores 

    def calculate_centroid(self, points: np.ndarray) -> Optional[np.ndarray]:
        """Calculates the centroid (geometric center) of a set of points."""
        if not isinstance(points, np.ndarray):
            print("Error: Input must be a NumPy array.")
            return None
        
        if points.ndim != 2:
            print(f"Error: Input array must be 2-dimensional (shape: {points.shape}).")
            return None
            
        if points.shape[0] == 0:
            print("Error: Input array cannot be empty.")
            return None
            
        # Check if dimension is reasonable (e.g., 2 for 2D, 3 for 3D)
        # This is a basic check, could be more specific if needed
        if points.shape[1] < 1:
            print(f"Error: Points must have at least one dimension (shape: {points.shape}).")
            return None

        try:
            centroid = np.mean(points, axis=0)
            return centroid
        except Exception as e:
            print(f"Error calculating centroid: {e}")
            return None 

    def calculate_similarity_matrix(self, embeddings_matrix: np.ndarray) -> Optional[np.ndarray]:
        """Calculates the pairwise cosine similarity matrix for a matrix of embeddings."""
        if not isinstance(embeddings_matrix, np.ndarray) or embeddings_matrix.ndim != 2 or embeddings_matrix.shape[0] < 1:
            print("Error: Input must be a valid 2D numpy array with at least one embedding.")
            return None
        # Handle case with only 1 embedding (similarity matrix is just [[1.]])
        if embeddings_matrix.shape[0] == 1:
            return np.array([[1.0]])
        try:
            # cosine_similarity calculates row-wise similarities
            similarity_matrix = cosine_similarity(embeddings_matrix)
            # Ensure diagonal is exactly 1.0 (sometimes minor float errors, although often handled)
            # np.fill_diagonal(similarity_matrix, 1.0) # Optional: uncomment if needed
            return similarity_matrix
        except Exception as e:
            print(f"Error calculating similarity matrix: {e}")
            return None 