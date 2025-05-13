import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from umap import UMAP
from typing import Tuple, List, Optional, Dict, Any, Set
import networkx as nx # Import networkx
# networkx.community will be accessed directly via nx.community
import matplotlib.colors as mcolors
import matplotlib.cm as cm

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
            # --- Choose UMAP initialization based on sample size ---
            # Spectral init can fail with very few samples (k >= N issue)
            umap_init_method = 'random' if n_samples < 5 else 'spectral'
            print(f"DEBUG [AnalysisService]: Using UMAP init method: {umap_init_method}")

            reducer = UMAP(
                n_components=n_components,
                n_neighbors=n_neighbors,
                min_dist=0.1, # Default min_dist
                random_state=42,
                init=umap_init_method, # Use conditional init method
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

    def create_semantic_graph(self,
                              embeddings_matrix: np.ndarray,
                              labels: List[str], # These are SHORT labels
                              source_documents: List[str], # <<< ADD THIS ARGUMENT
                              similarity_threshold: float = 0.7,
                              similarity_matrix: Optional[np.ndarray] = None
                             ) -> Optional[Tuple[nx.Graph, Dict[str, Any], Optional[List[Set[str]]]]]: # Modified return type
        """
        Creates a NetworkX graph based on semantic similarity between embeddings.
        Nodes are labeled with the provided (potentially shortened) labels.

        Args:
            embeddings_matrix: A (n_items, embedding_dim) numpy array.
            labels: A list of labels corresponding to the rows in embeddings_matrix.
            source_documents: A list of source document identifiers corresponding to labels.
            similarity_threshold: Minimum cosine similarity to create an edge.
            similarity_matrix: (Optional) Pre-computed similarity matrix.

        Returns:
            A tuple containing the NetworkX graph, a dictionary of metrics (degrees, betweenness),
            and a list of communities (list of sets of node labels), or (None, None, None).
        """
        # Input validation
        if embeddings_matrix is None or embeddings_matrix.ndim != 2:
            print("Error [create_semantic_graph]: Invalid embeddings_matrix.")
            return None, None, None # Modified return
        num_items = embeddings_matrix.shape[0]
        if not isinstance(labels, list) or len(labels) != num_items:
            print("Error [create_semantic_graph]: Labels mismatch embeddings.")
            return None, None, None # Modified return
        if num_items < 1:
             print("Error [create_semantic_graph]: Need at least one item.")
             return None, None, None # Modified return
        
        if not isinstance(source_documents, list) or len(source_documents) != num_items:
            print("Error [create_semantic_graph]: Number of source documents must match embeddings.")
            return None, None, None # Modified return

        # Compute similarity matrix if not provided
        if similarity_matrix is None:
            print("Computing similarity matrix for graph...")
            similarity_matrix = self.calculate_similarity_matrix(embeddings_matrix)
            if similarity_matrix is None:
                 print("Error [create_semantic_graph]: Failed to compute similarity matrix.")
                 return None, None, None # Modified return
            if similarity_matrix.shape != (num_items, num_items):
                 print(f"Error [create_semantic_graph]: Sim matrix shape mismatch.")
                 return None, None, None # Modified return

        # Create color map for documents
        unique_docs = sorted(list(set(source_documents)))
        num_docs = len(unique_docs)
        doc_color_map = {} # Initialize
        try:
            # Use a qualitative colormap
            colormap_name = 'tab10' if num_docs <= 10 else ('tab20' if num_docs <= 20 else 'viridis')
            colormap = cm.get_cmap(colormap_name, max(1, num_docs))
            doc_color_map = {doc_title: mcolors.to_hex(colormap(i)) for i, doc_title in enumerate(unique_docs)}
        except Exception as cmap_error:
             print(f"Warning: Error creating colormap: {cmap_error}. Using default colors.")
             doc_color_map = {doc_title: "#CCCCCC" for doc_title in unique_docs} # Fallback

        print(f"Building graph with threshold: {similarity_threshold}")
        G = nx.Graph()

        # Add nodes using the provided labels
        print(f"Adding {num_items} nodes with color attributes...")
        for i, label in enumerate(labels): # label is the SHORT label
            # Get the corresponding full source document title
            doc_title = source_documents[i]
            node_color = doc_color_map.get(doc_title, "#CCCCCC") # Default grey

            # Add node with attributes for Graphviz
            try:
                 G.add_node(label, index=i, fillcolor=node_color, style='filled', fontcolor='black')
                 # print(f"Added node: {label}, color: {node_color}") # Optional debug
            except Exception as node_add_error:
                 print(f"Error adding node {label}: {node_add_error}")
                 G.add_node(label, index=i) # Add basic node on error

        # Add edges based on threshold
        edge_count = 0
        for i in range(num_items):
            for j in range(i + 1, num_items):
                similarity = similarity_matrix[i, j]
                if float(similarity) >= similarity_threshold:
                    score = float(similarity)
                    G.add_edge(labels[i], labels[j],
                               weight=round(score, 4),
                               label=f"{score:.2f}", # Label for Graphviz edge
                               fontsize=8) # For Graphviz edge
                    edge_count +=1

        # Calculate node degrees
        degrees = dict(G.degree())
        print(f"Calculated degrees for {len(degrees)} nodes.")

        try:
             print("Calculating betweenness centrality...")
             # Calculate unweighted betweenness for simplicity first
             betweenness = nx.betweenness_centrality(G, normalized=True, endpoints=False)
             print(f"Calculated betweenness for {len(betweenness)} nodes.")
        except Exception as e:
             print(f"Error calculating betweenness centrality: {e}")
             betweenness = {} # Return empty dict on error

        # --- Prepare return dictionary for metrics ---
        graph_metrics = {
            'degrees': degrees,
            'betweenness': betweenness
            # Communities will be returned separately
        }

        communities_list = [] # Initialize
        try:
             print("Detecting communities using Louvain method...")
             # Pass the graph G, use weight=None for unweighted, or 'weight' if desired
             detected_communities_sets = nx.community.louvain_communities(G, weight=None, seed=42)
             # Convert frozensets to regular sets of strings (node labels)
             communities_list = [set(community_fset) for community_fset in detected_communities_sets]
             print(f"Detected {len(communities_list)} communities.")
        except ImportError: # This might catch if python-louvain is not found by networkx
            print("Warning: Community detection may require 'python-louvain'. Please ensure it's installed (`pip install python-louvain`). Skipping community detection.")
            communities_list = None
        except Exception as e:
             print(f"Error during community detection: {e}")
             communities_list = None # Indicate failure

        print(f"Graph created: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges (Counted: {edge_count}).")
        # Modify the return statement
        return G, graph_metrics, communities_list # Return graph, metrics dict, and list of communities 

    def create_top_n_neighbors_graph(self,
                                    embeddings_matrix: np.ndarray,
                                    labels: List[str],
                                    source_documents: List[str],
                                    n_neighbors: int = 3,
                                    similarity_matrix: Optional[np.ndarray] = None
                                   ) -> Optional[Tuple[nx.Graph, Dict[str, Any], Optional[List[Set[str]]]]]:
        """
        Creates a NetworkX graph where each node is connected to its top N most similar neighbors (excluding self).
        Nodes are labeled with the provided (potentially shortened) labels.

        Args:
            embeddings_matrix: A (n_items, embedding_dim) numpy array.
            labels: A list of labels corresponding to the rows in embeddings_matrix.
            source_documents: A list of source document identifiers corresponding to labels.
            n_neighbors: Number of top neighbors to connect for each node.
            similarity_matrix: (Optional) Pre-computed similarity matrix.

        Returns:
            A tuple containing the NetworkX graph, a dictionary of metrics (degrees, betweenness),
            and a list of communities (list of sets of node labels), or (None, None, None).
        """
        if embeddings_matrix is None or embeddings_matrix.ndim != 2:
            print("Error [create_top_n_neighbors_graph]: Invalid embeddings_matrix.")
            return None, None, None
        num_items = embeddings_matrix.shape[0]
        if not isinstance(labels, list) or len(labels) != num_items:
            print("Error [create_top_n_neighbors_graph]: Labels mismatch embeddings.")
            return None, None, None
        if num_items < 1:
            print("Error [create_top_n_neighbors_graph]: Need at least one item.")
            return None, None, None
        if not isinstance(source_documents, list) or len(source_documents) != num_items:
            print("Error [create_top_n_neighbors_graph]: Number of source documents must match embeddings.")
            return None, None, None

        if similarity_matrix is None:
            similarity_matrix = self.calculate_similarity_matrix(embeddings_matrix)
            if similarity_matrix is None:
                print("Error [create_top_n_neighbors_graph]: Failed to compute similarity matrix.")
                return None, None, None
            if similarity_matrix.shape != (num_items, num_items):
                print(f"Error [create_top_n_neighbors_graph]: Sim matrix shape mismatch.")
                return None, None, None

        # Create color map for documents
        unique_docs = sorted(list(set(source_documents)))
        num_docs = len(unique_docs)
        doc_color_map = {}
        try:
            colormap_name = 'tab10' if num_docs <= 10 else ('tab20' if num_docs <= 20 else 'viridis')
            colormap = cm.get_cmap(colormap_name, max(1, num_docs))
            doc_color_map = {doc_title: mcolors.to_hex(colormap(i)) for i, doc_title in enumerate(unique_docs)}
        except Exception as cmap_error:
            print(f"Warning: Error creating colormap: {cmap_error}. Using default colors.")
            doc_color_map = {doc_title: "#CCCCCC" for doc_title in unique_docs}

        G = nx.Graph()
        for i, label in enumerate(labels):
            doc_title = source_documents[i]
            node_color = doc_color_map.get(doc_title, "#CCCCCC")
            try:
                G.add_node(label, index=i, fillcolor=node_color, style='filled', fontcolor='black')
            except Exception as node_add_error:
                print(f"Error adding node {label}: {node_add_error}")
                G.add_node(label, index=i)

        # Add edges: for each node, connect to its top N most similar neighbors (excluding self)
        for i in range(num_items):
            similarities = similarity_matrix[i].copy()
            similarities[i] = -np.inf  # Exclude self
            top_indices = np.argsort(similarities)[-n_neighbors:]
            for j in top_indices:
                if j != i:
                    score = float(similarity_matrix[i, j])
                    G.add_edge(labels[i], labels[j], weight=round(score, 4), label=f"{score:.2f}", fontsize=8)

        degrees = dict(G.degree())
        try:
            betweenness = nx.betweenness_centrality(G, normalized=True, endpoints=False)
        except Exception as e:
            print(f"Error calculating betweenness centrality: {e}")
            betweenness = {}

        graph_metrics = {
            'degrees': degrees,
            'betweenness': betweenness
        }

        communities_list = []
        try:
            detected_communities_sets = nx.community.louvain_communities(G, weight=None, seed=42)
            communities_list = [set(community_fset) for community_fset in detected_communities_sets]
        except ImportError:
            print("Warning: Community detection may require 'python-louvain'. Please ensure it's installed (`pip install python-louvain`). Skipping community detection.")
            communities_list = None
        except Exception as e:
            print(f"Error during community detection: {e}")
            communities_list = None

        return G, graph_metrics, communities_list 