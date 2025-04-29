Phase 1: Core Setup & Basic Semantic Analysis (Refining voronoi4-1)
Goal: Establish document handling, embedding, basic N-dimensional analysis, and visualization foundations.
Instructions for Cursor/Gemini:
models/document.py: Ensure Document class exists, can store content, metadata, and a field for embedding: Optional[np.ndarray] = None. Add a field chunks: List[Any] = [] (define Chunk later).
services/embedding_service.py: Create/confirm service using sentence-transformers (e.g., 'all-MiniLM-L6-v2') to generate np.ndarray embeddings for text.
# Example function signature
def generate_embedding(self, text: str) -> np.ndarray: ...
Use code with caution.
Python
services/analysis_service.py (New or enhance existing):
Add function calculate_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float (e.g., using cosine similarity).
Add function reduce_dimensions(embeddings: np.ndarray, n_components: int = 2) using UMAP (umap-learn) or PCA (scikit-learn).
Add function find_k_nearest(query_emb: np.ndarray, corpus_embeddings: np.ndarray, k: int)
services/visualization_service.py: Create/confirm service using plotly.
Function plot_scatter_2d(coords: np.ndarray, labels: List[str]).
Function plot_scatter_3d(coords: np.ndarray, labels: List[str]).
app.py (Streamlit):
Load documents (text files for now).
Button to generate embeddings for loaded documents using EmbeddingService.
Buttons/options to generate and display 2D/3D UMAP plots using AnalysisService and VisualizationService.
Basic interface to select a document and find/display its K nearest neighbors.
Phase 2: Contextual Document Chunking
Goal: Implement chunking based on context instead of token count.
Instructions for Cursor/Gemini:
models/chunk.py: Define a Chunk class/dataclass:
@dataclasses.dataclass
class Chunk:
    id: str
    document_id: str
    content: str
    context_label: str # e.g., Chapter title, Topic name, Section number
    start_char: int
    end_char: int
    embedding: Optional[np.ndarray] = None
Use code with caution.
Python
services/chunking_service.py: Create the ImportanceChunker (or rename ContextualChunker).
Input: Document object. Output: List[Chunk].
Method 1 (Structural): Implement _chunk_by_structure(document).
Attempt to parse headings (e.g., Markdown #, ## or simple regex like ^\d+\.\s+ or ^CHAPTER\s+\d+).
If structure found, create Chunk objects for each section, using headings as context_label.
Method 2 (Semantic - Fallback): Implement _chunk_by_semantic_similarity(text: str, threshold: float = 0.3, window: int = 2).
Split text into sentences (use nltk or spacy).
Generate embeddings for sentences using EmbeddingService.
Calculate cosine similarity between adjacent sentence embeddings (or sentence windows).
Identify boundaries where similarity drops below threshold.
Group sentences between boundaries into Chunk objects, assign generic context_label like "Semantic Segment X".
Main chunk_document(document) method: Try structural first. If insufficient (e.g., < 2 sections or sections too long), apply semantic chunking to the whole document or within long structural sections. Store results in document.chunks.
app.py: Add button "Chunk Documents". After chunking, display the list of chunks (context label, maybe start of content). Modify embedding generation to also embed chunks. Modify visualization/analysis to work on chunk embeddings instead of/in addition to document embeddings.
Phase 3: Lossless Path Encoding & Basic Super Tokens
Goal: Implement the Prime Hierarchy encoding for paths (representing derivations) and define Super Tokens that use this.
Instructions for Cursor/Gemini:
Install BigInt Library: Add gmpy2 to your requirements.txt. Crucially, tell Cursor to import gmpy2 and use gmpy2.mpz() for calculations involving the encoding. Mention that standard Python ints will overflow.
services/path_encoding_service.py (New):
Implement the prime helper functions (sieve, nth_prime, prime_index) using gmpy2.mpz where appropriate and dynamic sieve extension. Store PRIMES and P_INDEX efficiently.
Implement encode_path(edge_ids: List[gmpy2.mpz], block: int, depth_limit: int) -> Tuple[gmpy2.mpz, int] using gmpy2.mpz for all arithmetic and the relabeling logic for depths > 0. edge_ids are the stable, canonical prime labels for edges.
Implement decode_path(code: gmpy2.mpz, depth: int, block: int) -> List[gmpy2.mpz] using gmpy2.mpz, prime_index, and prime_factors.
Implement prime_factors(n: gmpy2.mpz) -> List[gmpy2.mpz].
Graph Representation: Decide on a simple graph representation for now (e.g., networkx library or simple adjacency lists). Nodes represent concepts/chunks/documents. Edges represent relationships (φᵢ). Crucially, define a stable, canonical way to assign prime numbers to outgoing edges from each node. (e.g., sort target node IDs alphabetically, assign primes 2, 3, 5...). Store this mapping.
models/super_token.py:
Define SuperToken class.
Include id: str (maybe UUID).
Include claim: str (the derived concept).
Include path_code: gmpy2.mpz (the C from encoding).
Include path_depth: int (the d from encoding).
Include derivation_path: Optional[List[gmpy2.mpz]] = None (decoded path, lazy loaded).
Include embedding: Optional[np.ndarray] = None.
services/knowledge_graph_service.py (New):
Manages the graph (networkx?).
Provides methods to add nodes/edges.
Provides method get_canonical_edge_prime(source_node, target_node) based on the stable labeling scheme.
Provides method find_path(start_node, end_node) (e.g., simple BFS/DFS for now).
Provides method register_super_token_for_path(path: List[nodes], claim: str):
Gets edge primes for the path using get_canonical_edge_prime.
Encodes the path using PathEncodingService.
Creates and stores a SuperToken.
app.py: Add basic interface elements to visualize the graph (if simple), select start/end nodes, find a path, encode it, and display the resulting Super Token info (Claim, Path Code C, Depth d).
Phase 4: Anisotropy & Lossy State Encoding (Foundation for Future)
Goal: Lay groundwork for learning graph dynamics and implementing lossy summaries. Mark as experimental/future.
Instructions for Cursor/Gemini:
Data Collection: Plan how to store path traversal history or edge weights to eventually learn P(e|v). (e.g., add weights to graph edges, update them after simulated traversals). For now, maybe just assign random weights or uniform probabilities.
Define Placeholder: In models/node.py (if you create a dedicated Node class for the graph) or associated with node IDs, add a field lossy_summary: Optional[Any] = None.
Create Placeholder Service: services/lossy_encoding_service.py with a placeholder function signature:
# Placeholder - actual implementation is complex
def generate_lossy_summary(node_state, transition_probabilities) -> Any:
    # TODO: Implement methods like weighted feature reduction, etc.
    # For now, maybe return first N dimensions of embedding or hash of features.
    print("Warning: Using placeholder lossy summary.")
    if isinstance(node_state, np.ndarray):
        return node_state[:10].tolist() # Example placeholder
    return hash(str(node_state))
Use code with caution.
Python
No UI Integration Yet: This phase is about setting up the concepts in the code structure.
Phase 5: Advanced Dynamics (Future Exploration)
Goal: Implement Packet architecture, bidirectional search comparison. Mark as future exploration.
Instructions for Cursor/Gemini:
Conceptual: Explain that future work involves creating a Packet class containing header/payload as discussed (including (C,d) and Sᵢ).
Algorithm Sketch: Outline the bidirectional search logic and the concept of the "observer" comparing packet states (Sᵢ or other features) near the meeting point.
No Implementation Yet: This is purely conceptual planning at this stage.
