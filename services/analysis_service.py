import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from umap import UMAP
from typing import Tuple, List, Optional

class AnalysisService:
    """Provides methods for embedding analysis, including similarity calculation, dimensionality reduction, and nearest neighbor search."""
    MIN_N_NEIGHBORS_FOR_UMAP = 2 # UMAP requirement

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

    def reduce_dimensions(self, embeddings: np.ndarray, n_components: int = 2) -> Optional[np.ndarray]:
        """Reduces the dimensionality of embeddings using UMAP."""
        if not isinstance(embeddings, np.ndarray) or embeddings.ndim != 2:
            # Log error or raise ValueError instead of using st.error
            print("ERROR [AnalysisService]: Embeddings must be a 2D numpy array.")
            # raise ValueError("Embeddings must be a 2D numpy array.")
            return None # Return None to indicate failure

        n_samples = embeddings.shape[0]

        # --- Strict check for minimum samples for UMAP --- 
        # UMAP needs n_samples > n_neighbors, and n_neighbors >= 2 is required for stability.
        # Therefore, we need at least MIN_N_NEIGHBORS_FOR_UMAP + 1 samples.
        min_samples_needed = self.MIN_N_NEIGHBORS_FOR_UMAP + 1
        if n_samples < min_samples_needed:
             print(f"Warning [AnalysisService]: UMAP requires at least {min_samples_needed} samples (found {n_samples}). Cannot reduce dimensions.")
             return None # Return None to indicate failure

        # Adjust n_neighbors based on samples, ensuring it's >= MIN_N_NEIGHBORS_FOR_UMAP
        # A common default for UMAP is 15
        n_neighbors = min(15, n_samples - 1) # Max n_neighbors is n_samples - 1
        n_neighbors = max(self.MIN_N_NEIGHBORS_FOR_UMAP, n_neighbors) # Ensure it's at least 2

        print(f"DEBUG [AnalysisService]: n_samples: {n_samples}, Calculated n_neighbors: {n_neighbors}")

        # <<< REMOVED previous n_neighbors <= 1 check/warning, handled by min_samples_needed check >>>

        try:
            reducer = UMAP(
                n_components=n_components,
                n_neighbors=n_neighbors,
                min_dist=0.1, # Default min_dist
                random_state=42,
                # metric='cosine' # Consider adding if appropriate for your embeddings
            )
            reduced_embeddings = reducer.fit_transform(embeddings)
            return reduced_embeddings
        except Exception as e:
            print(f"Error [AnalysisService]: Error during UMAP dimensionality reduction: {e}")
            # Optionally re-raise the exception or provide more context
            # raise e 
            return None # Return None on error

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