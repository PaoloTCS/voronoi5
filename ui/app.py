# -*- coding: utf-8 -*-
import streamlit as st
import numpy as np
import os
import io # Added io
import pandas as pd # Added pandas import
from typing import List, Tuple, Optional
from PyPDF2 import PdfReader # Corrected capitalization
import networkx as nx # Import networkx
import plotly.express as px # Add import for colors
import streamlit.components.v1 as components # Import Streamlit components
import graphviz # <<< Add graphviz import
import gmpy2 # Added gmpy2 for path encoding tests
import traceback
from datetime import datetime

# --- Path Setup for Sibling Module Imports ---
import sys
# Add the project root directory to sys.path to allow sibling module imports
# e.g., for 'models' directory when running app.py from 'ui' directory.
# os.path.abspath(__file__) gives the path to app.py
# os.path.dirname(...) gives the 'ui' directory
# os.path.join(..., '..') goes up one level to the project root
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)
# --- End Path Setup ---

# Project Modules
from models.document import Document
from models.chunk import Chunk
from services.ai.embedding_service import EmbeddingService
from services.ai.analysis_service import AnalysisService
from visualization.scatter_plotter import VisualizationService
from services.ai.text_processor import ContextualChunker
from services.knowledge_graph_service import KnowledgeGraphService
from models.knowledge_graph import KnowledgeGraph
from services.path_encoding_service import PathEncodingService

# --- Configuration & Constants ---
# SAMPLE_DOCS removed for brevity, assume they exist if needed later
DEFAULT_K = 3
MIN_ITEMS_FOR_PLOT = 4 # Minimum items (Docs/Chunks) needed for a meaningful plot

# --- Service Initialization with Caching ---
# Use st.cache_resource to load models/services only once
@st.cache_resource
def load_embedding_service():
    try:
        return EmbeddingService()
    except Exception as e:
        st.error(f"Error loading Embedding Service: {e}")
        return None

@st.cache_resource
def load_analysis_service():
    return AnalysisService()

@st.cache_resource
def load_visualization_service():
    return VisualizationService()

@st.cache_resource
def load_chunker(_embedding_service, _analysis_service):
    """Loads the ContextualChunker, ensuring dependencies are met."""
    if not _embedding_service or not _analysis_service:
        st.error("Cannot initialize Chunker: Embedding or Analysis service failed to load.")
        return None
    try:
        return ContextualChunker(embedding_service=_embedding_service, analysis_service=_analysis_service)
    except Exception as e:
        st.error(f"Error loading Contextual Chunker: {e}")
        return None

@st.cache_resource
def load_path_encoding_service():
    return PathEncodingService() # Default block_size, depth_limit

@st.cache_resource # Or st.session_state if it manages a graph instance
def load_knowledge_graph_service():
    # If KGService manages THE graph, it should be in session_state
    # For now, let's assume it can be cached if it operates on a passed graph
    if 'knowledge_graph_instance' not in st.session_state:
         st.session_state.knowledge_graph_instance = KnowledgeGraph(name="MainKG_App")
    # If KGService is stateless and operates on passed graph:
    # return KnowledgeGraphService()
    # If KGService manages its own graph instance:
    return KnowledgeGraphService(knowledge_graph=st.session_state.knowledge_graph_instance)

embedding_service = load_embedding_service()
analysis_service = load_analysis_service()
visualization_service = load_visualization_service()
chunker = load_chunker(embedding_service, analysis_service)
path_encoding_service = load_path_encoding_service()
knowledge_graph_service = load_knowledge_graph_service()

# --- Session State Initialization ---
def initialize_session_state():
    defaults = {
        'documents': [],
        'embeddings_generated': False,
        'all_chunk_embeddings_matrix': None,
        'all_chunk_labels': [],
        'chunk_label_lookup_dict': {},
        'analysis_level': 'Documents',
        'scatter_fig_2d': None,
        'current_coords_2d': None,
        'current_labels': [],
        'coords_3d': None,
        'current_view': 'splash', # Possible values: 'splash', 'analysis'
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

initialize_session_state()

# --- Helper Functions ---
def reset_derived_data(clear_docs=False):
    """Clears embeddings, chunks, derived data. Optionally clears documents too."""
    if clear_docs:
        st.session_state.documents = []
    else:
        # Only clear derived data from docs if keeping them
        for doc in st.session_state.documents:
            doc.embedding = None
            if hasattr(doc, 'chunks'):
                doc.chunks = []

    # Reset all derived state regardless
    st.session_state.embeddings_generated = False
    st.session_state.coords_2d = None
    st.session_state.coords_3d = None
    st.session_state.all_chunk_embeddings_matrix = None
    st.session_state.all_chunk_labels = []
    st.session_state.chunk_label_lookup_dict = {}
    st.session_state.analysis_level = 'Documents' # Default level
    st.session_state.scatter_fig_2d = None
    st.session_state.current_coords_2d = None
    st.session_state.current_labels = []


# --- Splash Page ---
def render_splash_page():
    st.title("Voronoi6 - Knowledge Explorer")
    st.markdown("---")
    st.markdown("""
    ### Map the Semantic DNA of Your Information.
    
    Turn your complex collection of documents, code, and text into a dynamic, visual knowledge network. Voronoi6 uses advanced semantic analysis to automatically cluster related concepts, build relational graphs, and reveal the underlying structure of your information ecosystem.
    
    *   📂 **From Document to Insight:** Transform research papers, PDFs, and code into an interactive conceptual map.
    *   🌐 **Navigate Semantic Space:** Explore clusters of related knowledge, identify conceptual gaps, and visualize non-obvious connections.
    *   🪞 **Detect Semantic Drift:** *(Future capability - illustrates vision)* Understand how ideas evolve and diverge using our proprietary Semantic Shadow monitoring.
    *   🛡️ **Private Knowledge Ecosystems:** *(Future capability - illustrates vision)* Build and manage secure knowledge graphs for your team or organization.
    
    Empowering research labs, legal firms, R&D departments, and knowledge-driven organizations to navigate complexity and accelerate discovery.
    
    **Unlock the hidden structure. Visualize your insights.**
    """)
    st.markdown("---")
    st.header("How to Use Voronoi6")
    st.markdown("""
    Follow these steps to explore your documents:
    
    1.  **Upload Documents:**
        *   Use the file uploader in the left panel to select one or more TXT or PDF files.
        *   Click the **"Process Uploaded Files"** button. Your documents will be listed under "View Loaded Documents".
    
    2.  **Process Documents:**
        *   After uploading, click **"Process Uploaded Files"**.
    
    3.  **Visualize & Analyze:**
        *   Once processed, you will be taken to the analysis and visualization tools.
    """)
    st.markdown("---")
    # No document loading controls here; they are in the sidebar.
    # Optionally, show loaded docs summary here if desired.

# --- Sidebar for Loading and Options (always visible) ---
st.sidebar.header("Document Loading")
uploaded_files = st.sidebar.file_uploader(
    "Upload Documents (TXT or PDF)",
    type=['txt', 'pdf'],
    accept_multiple_files=True,
    key="file_uploader"
)
if st.sidebar.button("Process Uploaded Files"):
    if uploaded_files:
        new_docs_added = []
        current_doc_names = {doc.title for doc in st.session_state.documents}
        should_reset_derived = False
        for uploaded_file in uploaded_files:
            if uploaded_file.name in current_doc_names:
                st.sidebar.warning(f"Skipping '{uploaded_file.name}': Name already exists.")
                continue
            text = ""
            try:
                if uploaded_file.type == 'application/pdf':
                    reader = PdfReader(uploaded_file)
                    text = "".join(page.extract_text() for page in reader.pages if page.extract_text())
                    if not text:
                        st.sidebar.error(f"Could not extract text from PDF '{uploaded_file.name}'. Skipping.")
                        continue
                elif uploaded_file.type == 'text/plain':
                    text = uploaded_file.getvalue().decode("utf-8")
                else:
                    st.sidebar.error(f"Unsupported file type: {uploaded_file.type} for '{uploaded_file.name}'")
                    continue
                new_doc = Document(
                    title=uploaded_file.name, content=text,
                    metadata={'source': 'upload', 'type': uploaded_file.type, 'size': uploaded_file.size}
                )
                new_docs_added.append(new_doc)
                current_doc_names.add(uploaded_file.name)
                st.sidebar.success(f"Processed '{uploaded_file.name}'")
                should_reset_derived = True
            except Exception as e:
                st.sidebar.error(f"Error processing file '{uploaded_file.name}': {e}")
        if new_docs_added:
            if should_reset_derived:
                print("New documents added, resetting derived data (embeddings, plots, matrices).")
                reset_derived_data(clear_docs=False)
            st.session_state.documents = st.session_state.documents + new_docs_added
            st.sidebar.info(f"Added {len(new_docs_added)} new documents.")
            st.session_state.current_view = 'analysis'
            st.rerun()
    else:
        st.sidebar.warning("No files selected in the uploader to process.")
if st.sidebar.button("Clear All Documents"):
    reset_derived_data(clear_docs=True)
    st.sidebar.info("All loaded documents and data cleared.")
    st.session_state.current_view = 'splash'
    st.rerun()
st.sidebar.caption("Use the 'x' in the uploader UI to remove selected files before processing.")
if st.session_state.documents:
    with st.sidebar.expander("View Loaded Documents", expanded=False):
        for i, doc in enumerate(st.session_state.documents):
            embed_status = "Yes" if doc.embedding is not None else "No"
            st.markdown(f"**{i+1}. {doc.title}** - Doc Embedding: {embed_status}")
            if hasattr(doc, 'chunks') and doc.chunks:
                chunk_embed_counts = sum(1 for chunk in doc.chunks if chunk.embedding is not None)
                st.markdown(f"    Chunks: {len(doc.chunks)} ({chunk_embed_counts} embedded)")
            elif hasattr(doc, 'chunks'):
                st.markdown("    Chunks: 0")
            else:
                st.markdown("    Chunks: Not Processed")
            st.divider()

# --- Analysis Page ---
def render_analysis_page():
    st.title("Voronoi6 - Document Analysis Tool")
    # --- Step Explanation Panel ---
    st.subheader("Current Status & Next Steps")
    last_action = st.session_state.get("last_action")
    explanation = ""
    num_docs = len(st.session_state.get('documents', []))
    num_chunks = st.session_state.get('num_chunks_processed', 0)
    num_chunk_embeddings = len(st.session_state.get('all_chunk_labels', []))
    num_doc_embeddings = sum(1 for doc in st.session_state.documents if doc.embedding is not None)
    if last_action == "embedded":
        explanation = (
            f"**Embeddings Generated!** Semantic embeddings are now ready for **{num_doc_embeddings} documents** and **{num_chunk_embeddings} chunks**.\n\n"
            f"*   Each embedding is a high-dimensional vector representing the meaning of the text. "
            f"This allows the system to understand and compare content computationally.\n"
            f"*   **Next:** Explore the semantic relationships!\n"
            f"    *   Select 'Chunks' under 'Analysis Configuration'.\n"
            f"    *   Click 'Show 2D Plot' to visualize the semantic space.\n"
            f"    *   Explore the 'Semantic Chunk Graph' to see direct similarity connections."
        )
    elif last_action == "chunked":
        explanation = (
            f"**Chunking Complete!** Your documents have been segmented into **{num_chunks}** chunks.\n\n"
            f"*   These chunks aim to capture meaningful passages or structural sections from your documents. "
            f"Our Contextual Chunker first looks for structural cues (like chapters); if not prominent, "
            f"it uses semantic similarity between sentences to find natural topic breaks.\n"
            f"*   You can see an overview in the 'View Document/Chunk Structure' expander (below, after generating embeddings).\n"
            f"*   **Next Step:** Click **'Generate Embeddings'** (in the sidebar or a dedicated 'Process' section if you create one). "
            f"This will convert each chunk and document into numerical embeddings."
        )
    elif num_docs > 0:
        explanation = (
            f"**Welcome to the Analysis Workbench!** **{num_docs} documents** are loaded.\n\n"
            f"*   **Next Step: Chunking.** Click **'Chunk Loaded Documents'** (in the sidebar or a 'Process' section). "
            f"This breaks documents into smaller, semantically coherent units. Our Contextual Chunker "
            f"prioritizes structure (chapters) then falls back to semantic breaks for nuanced segmentation.\n"
            f"*   After chunking, you will **'Generate Embeddings'** to enable analysis."
        )
    else:
        explanation = "Please go to the 'Upload' page to load and process documents first."
    st.info(explanation)
    st.markdown("---")
    num_docs = len(st.session_state.documents) if 'documents' in st.session_state and st.session_state.documents else 0

    # Use all_chunk_labels only if it exists and is non-empty, else sum all doc chunks
    if st.session_state.get('all_chunk_labels') and len(st.session_state['all_chunk_labels']) > 0:
        num_chunks = len(st.session_state['all_chunk_labels'])
    else:
        num_chunks = sum(len(doc.chunks) for doc in st.session_state.documents if hasattr(doc, 'chunks') and doc.chunks)

    num_chunk_embeddings = sum(
        1 for doc in st.session_state.documents if hasattr(doc, 'chunks') and doc.chunks
        for chunk in doc.chunks if getattr(chunk, 'embedding', None) is not None
    )

    col1, col2, col3 = st.columns(3)
    col1.metric("Loaded Documents", num_docs)
    col2.metric("Processed Chunks", num_chunks)
    col3.metric("Generated Embeddings", num_chunk_embeddings)
    st.caption(f"Voronoi6 App - v6.0 Demo - Last Updated: {datetime.now().strftime('%Y-%m-%d')}")
    st.write("Analysis and visualization tools go here. (To be refactored in next steps.)")
    # ...rest of analysis UI...

    st.header("Analysis Configuration")
    st.radio(
        "Analyze/Visualize Level:", ('Documents', 'Chunks'),
        key='analysis_level', horizontal=True
    )
    current_selected_analysis_level = st.session_state.analysis_level
    if current_selected_analysis_level == 'Documents':
        st.info(
            "**Document Level Analysis:** \n\n"
            "- Each point in the visualizations represents an entire document. \n"
            "- This gives a high-level overview of how your documents relate to each other semantically. \n"
            "- Useful for finding broadly similar documents or distinct thematic groups. \n"
            "- *Note: Dimensionality reduction (UMAP) requires at least 4 documents for a stable plot.*"
        )
    elif current_selected_analysis_level == 'Chunks':
        st.info(
            "**Chunk Level Analysis:** \n\n"
            "- Each point represents a smaller, semantically coherent chunk of text from your documents. \n"
            "- This provides a more granular view, revealing specific areas of overlap or distinct sub-topics within and between documents. \n"
            "- Ideal for detailed exploration of conceptual relationships and identifying nuanced connections. \n"
            "- The Semantic Chunk Graph and detailed metrics are based on this level."
        )
    st.markdown("---")

# --- Main App Routing ---
if st.session_state.get('current_view', 'splash') == 'splash':
    render_splash_page()
else:
    render_analysis_page()

# --- Processing Section ---
st.sidebar.header("Processing")

# Chunking Button
if st.sidebar.button("Chunk Loaded Documents", disabled=not chunker or not st.session_state.documents):
    if chunker and st.session_state.documents:
        updated_documents = []
        error_occurred = False
        try:
            with st.spinner("Chunking documents..."):
                for doc in st.session_state.documents:
                    try:
                        if not hasattr(doc, 'chunks'): doc.chunks = []
                        doc.chunks = chunker.chunk_document(doc)
                        updated_documents.append(doc)
                    except Exception as e:
                        st.sidebar.error(f"Error chunking doc '{doc.title}': {e}")
                        updated_documents.append(doc)
                        error_occurred = True
            st.session_state.documents = updated_documents
            msg = f"Chunking complete for {len(st.session_state.documents)} documents."
            if error_occurred:
                st.sidebar.warning(msg + " (with errors)")
            else:
                st.sidebar.success(msg)
            # Store total chunks after chunking
            total_chunks_after_chunking = sum(len(doc.chunks) for doc in st.session_state.documents if hasattr(doc, 'chunks'))
            st.session_state.num_chunks_processed = total_chunks_after_chunking
            st.session_state.last_action = "chunked"
            st.rerun()
        except Exception as e:
            st.sidebar.error(f"An unexpected error occurred during chunking: {e}")
            error_occurred = True
            if not error_occurred or updated_documents:
                reset_derived_data(clear_docs=False)
            st.rerun()
    elif not chunker:
        st.sidebar.error("Chunking Service not available.")
    else:
        st.sidebar.warning("No documents loaded to chunk.")

# Embedding Button
if st.sidebar.button("Generate Embeddings", disabled=not embedding_service or not st.session_state.documents):
    if embedding_service and st.session_state.documents:
        try:
            with st.spinner("Generating embeddings for documents and chunks..."):
                docs_processed_count = 0
                chunks_processed_count = 0
                error_occurred = False
                updated_documents = list(st.session_state.documents)
                for i, doc in enumerate(updated_documents):
                    if doc.embedding is None:
                        try:
                            doc.embedding = embedding_service.generate_embedding(doc.content)
                            if doc.embedding is not None: docs_processed_count += 1
                        except Exception as e:
                            st.sidebar.error(f"Error embedding doc '{doc.title}': {e}")
                            error_occurred = True
                            continue
                    if hasattr(doc, 'chunks') and doc.chunks:
                        for chunk_idx, chunk in enumerate(doc.chunks):
                            if chunk.embedding is None:
                                try:
                                    chunk.embedding = embedding_service.generate_embedding(chunk.content)
                                    if chunk.embedding is not None: chunks_processed_count += 1
                                except Exception as e:
                                    st.sidebar.error(f"Error embedding chunk {chunk_idx} in doc '{doc.title}': {e}")
                                    error_occurred = True
                    updated_documents[i] = doc
                st.session_state.documents = updated_documents
                all_chunk_embeddings = []
                all_chunk_labels = []
                chunk_label_lookup_dict = {}
                for doc_idx, doc in enumerate(st.session_state.documents):
                    if hasattr(doc, 'chunks') and doc.chunks:
                        for chunk_idx, chunk in enumerate(doc.chunks):
                            if chunk.embedding is not None:
                                all_chunk_embeddings.append(chunk.embedding)
                                short_title = doc.title[:10] + ('...' if len(doc.title) > 10 else '')
                                short_context = chunk.context_label[:15] + ('...' if hasattr(chunk, 'context_label') and len(chunk.context_label) > 15 else '')
                                current_chunk_label = f"{short_title}::C{chunk_idx+1}({short_context})"
                                all_chunk_labels.append(current_chunk_label)
                                chunk_label_lookup_dict[current_chunk_label] = (chunk, doc.title)
                if all_chunk_embeddings:
                    st.session_state.all_chunk_embeddings_matrix = np.array(all_chunk_embeddings)
                    st.session_state.all_chunk_labels = all_chunk_labels
                    st.session_state.chunk_label_lookup_dict = chunk_label_lookup_dict
                else:
                    st.session_state.all_chunk_embeddings_matrix = None
                    st.session_state.all_chunk_labels = []
                    st.session_state.chunk_label_lookup_dict = {}
                st.session_state.embeddings_generated = True
                msg = f"Embeddings generated for {docs_processed_count} documents and {chunks_processed_count} chunks."
                if error_occurred:
                    st.sidebar.warning(msg + " (with errors)")
                else:
                    st.sidebar.success(msg)
                st.session_state.num_doc_embeddings_processed = docs_processed_count
                st.session_state.num_chunk_embeddings_processed = chunks_processed_count
                st.session_state.last_action = "embedded"
                st.rerun()
        except Exception as e:
            st.sidebar.error(f"An unexpected error occurred during embedding generation: {e}")
            reset_derived_data(clear_docs=False)
            st.rerun()
    elif not embedding_service:
        st.sidebar.error("Embedding Service not available.")
    else:
        st.sidebar.warning("No documents loaded to generate embeddings for.")

# --- Path Encoding Test Section (Interactive) ---
st.sidebar.header("Path Encoding (Phase 3 Dev)")

# Ensure services and graph data are available
if path_encoding_service and knowledge_graph_service and \
   st.session_state.get('all_chunk_labels') and \
   knowledge_graph_service.graph and knowledge_graph_service.graph.graph.number_of_nodes() > 0:

    node_options = sorted(list(knowledge_graph_service.graph.graph.nodes())) # Get nodes from the actual graph

    # --- Helper to format node label for display ---
    def format_node_label(node_label):
        # Example: "test_doc_A.txt::C1(Semantic Seg..." → "A.txt | C1 | Semantic Seg..."
        parts = node_label.split("::")
        doc = parts[0]
        doc_short = doc[-10:] if len(doc) > 10 else doc
        chunk = parts[1] if len(parts) > 1 else ""
        # Try to split chunk into chunk number and context
        if '(' in chunk and ')' in chunk:
            chunk_num = chunk.split('(')[0]
            context = chunk.split('(')[1].rstrip(')')
        else:
            chunk_num = chunk
            context = ""
        return f"{doc_short} | {chunk_num.strip()} | {context.strip()}"

    node_display_map = {format_node_label(n): n for n in node_options}
    display_options = list(node_display_map.keys())

    if len(display_options) < 2:
        st.sidebar.info("Graph needs at least 2 nodes to find a path.")
    else:
        start_display = st.sidebar.selectbox(
            "Select Start Node for Path:",
            display_options,
            index=0,
            key="path_start_node"
        )
        end_display = st.sidebar.selectbox(
            "Select End Node for Path:",
            display_options,
            index=min(1, len(display_options)-1),
            key="path_end_node"
        )

        # Show full node label as caption for clarity
        st.sidebar.caption(f"Start Node: {node_display_map[start_display]}")
        st.sidebar.caption(f"End Node: {node_display_map[end_display]}")

        start_node = node_display_map[start_display]
        end_node = node_display_map[end_display]

        if st.sidebar.button("Encode Selected Path"):
            if start_node == end_node:
                st.sidebar.error("Start and end nodes must be different.")
            else:
                st.sidebar.write(f"Finding path from '{start_node}' to '{end_node}'...")
                path_node_labels = knowledge_graph_service.find_path(start_node, end_node)

                if path_node_labels:
                    st.sidebar.write(f"Path Found: {' -> '.join(path_node_labels)}")
                    if len(path_node_labels) < 2:
                        st.sidebar.warning("Path is too short to have edges to encode.")
                    else:
                        edge_prime_ids_gmpy = []
                        path_edges_details = [] # For display

                        for i in range(len(path_node_labels) - 1):
                            u = path_node_labels[i]
                            v = path_node_labels[i+1]
                            prime = knowledge_graph_service.get_canonical_edge_prime(u,v)
                            if prime:
                                edge_prime_ids_gmpy.append(prime)
                                path_edges_details.append(f"Edge ({u} -> {v}): Prime {prime}")
                            else:
                                st.sidebar.error(f"Could not get prime for edge ({u} -> {v}). Aborting encoding.")
                                edge_prime_ids_gmpy = [] # Clear list to prevent encoding
                                break
                        
                        if edge_prime_ids_gmpy:
                            st.sidebar.write("**Edge Primes (as exponents for Gödel encoding):**")
                            for detail in path_edges_details:
                                st.sidebar.caption(detail)
                            
                            st.sidebar.write(f"Encoding gmpy primes (as exponents): {edge_prime_ids_gmpy}")
                            encoded_path_data = path_encoding_service.encode_path(edge_prime_ids_gmpy)

                            if encoded_path_data:
                                code_c, depth_d = encoded_path_data
                                st.sidebar.write(f"**Encoded Path (Gödel-style):**")
                                st.sidebar.markdown(f"    C = `{code_c}`")
                                st.sidebar.markdown(f"    d = `{depth_d}`")

                                decoded_primes = path_encoding_service.decode_path(code_c, depth_d)
                                st.sidebar.write(f"**Decoded Primes (exponents):** `{decoded_primes}`")

                                if decoded_primes and all(p_orig == p_dec for p_orig, p_dec in zip(edge_prime_ids_gmpy, decoded_primes)) and len(decoded_primes) == len(edge_prime_ids_gmpy):
                                    st.sidebar.success("Encode/Decode Test Passed for selected path!")
                                else:
                                    st.sidebar.error("Encode/Decode Test Failed for selected path.")
                            else:
                                st.sidebar.error("Path encoding failed.")
                else:
                    # Enhanced feedback when no path is found
                    start_degree = knowledge_graph_service.get_node_degree(start_node)
                    end_degree = knowledge_graph_service.get_node_degree(end_node)
                    st.sidebar.warning(f"No path found between '{start_node}' and '{end_node}'.")
                    st.sidebar.info(f"Start node degree: {start_degree}\nEnd node degree: {end_degree}")
                    if start_degree == 0 and end_degree == 0:
                        st.sidebar.error("Both selected nodes are isolated (no connections in the current graph). Try lowering the similarity threshold or increasing the number of neighbors.")
                    elif start_degree == 0:
                        st.sidebar.error("The start node is isolated (no connections in the current graph). Try lowering the similarity threshold or increasing the number of neighbors.")
                    elif end_degree == 0:
                        st.sidebar.error("The end node is isolated (no connections in the current graph). Try lowering the similarity threshold or increasing the number of neighbors.")
                    else:
                        st.sidebar.info("The selected nodes are in different disconnected components. Try lowering the similarity threshold, increasing the number of neighbors, or selecting different nodes.")
                        # --- New: Show reachable nodes from start node ---
                        try:
                            component_nodes = list(nx.node_connected_component(knowledge_graph_service.graph.graph, start_node))
                            component_size = len(component_nodes)
                            # Format for display (limit to 10 for brevity)
                            formatted_nodes = [format_node_label(n) for n in component_nodes if n != start_node]
                            max_display = 10
                            st.sidebar.markdown(f"**Nodes reachable from your selected start node:**")
                            if formatted_nodes:
                                for n in formatted_nodes[:max_display]:
                                    st.sidebar.caption(f"- {n}")
                                if len(formatted_nodes) > max_display:
                                    st.sidebar.caption(f"...and {len(formatted_nodes) - max_display} more.")
                            else:
                                st.sidebar.caption("(No other nodes reachable from this node.)")
                            st.sidebar.info(f"Total nodes in this connected component: {component_size}")
                            if end_node not in component_nodes:
                                st.sidebar.warning("End node is not in the same connected component as the start node.")
                        except Exception as e:
                            st.sidebar.error(f"Error analyzing connected component: {e}")
else:
    st.sidebar.info("Generate a graph with chunks first to test path encoding.")

# --- Always show a Refresh button for Path Encoding UI ---
if st.sidebar.button("Refresh Path Encoding UI"):
    st.rerun()

# --- Main Area Logic ---
st.markdown("""
This section allows you to visualize and analyze the semantic relationships
within your processed documents and their chunks.

**Getting Started:** If you haven't processed your own files yet,
consider loading and processing the sample text files provided in the
`examples/data/` directory (e.g., `lstm_details.txt`, `rnn_details.txt`, etc.)
via the "Upload" and "Process" tabs.
""")
st.markdown("---")

# Check if embeddings exist at the required level
embeddings_exist = False
items_available_for_level = 0
can_analyze = False # Flag to check if enough data for analysis exists

if st.session_state.get('embeddings_generated'):
    if st.session_state.analysis_level == 'Documents':
        items_available_for_level = sum(1 for doc in st.session_state.documents if doc.embedding is not None)
        if items_available_for_level >= MIN_ITEMS_FOR_PLOT:
            embeddings_exist = True # Enough docs with embeddings for plotting
        if items_available_for_level >= 1: # Need at least 1 for analysis
             can_analyze = True
    elif st.session_state.analysis_level == 'Chunks':
        # Check the matrix directly
        chunk_matrix = st.session_state.get('all_chunk_embeddings_matrix')
        if chunk_matrix is not None and chunk_matrix.shape[0] > 0:
             items_available_for_level = chunk_matrix.shape[0]
             embeddings_exist = True # Embeddings generated if matrix exists and is not empty
             can_analyze = True

# --- Similarity Matrix/Table Section ---
st.header("Pairwise Similarity Matrix")

# Determine which embeddings and labels to use based on analysis level
if st.session_state.analysis_level == 'Documents':
    docs_with_embeddings = [doc for doc in st.session_state.documents if doc.embedding is not None]
    if len(docs_with_embeddings) > 1:
        embeddings_matrix = np.array([doc.embedding for doc in docs_with_embeddings])
        labels = [doc.title for doc in docs_with_embeddings]
    else:
        embeddings_matrix = None
        labels = []
elif st.session_state.analysis_level == 'Chunks':
    embeddings_matrix = st.session_state.get('all_chunk_embeddings_matrix')
    labels = st.session_state.get('all_chunk_labels', [])
    if embeddings_matrix is not None and embeddings_matrix.shape[0] <= 1:
        embeddings_matrix = None
        labels = []
else:
    embeddings_matrix = None
    labels = []

if embeddings_matrix is not None and len(labels) > 1:
    similarity_matrix = analysis_service.calculate_similarity_matrix(embeddings_matrix)
    if similarity_matrix is not None:
        import pandas as pd
        df_sim = pd.DataFrame(similarity_matrix, index=labels, columns=labels)
        st.dataframe(df_sim.style.format("{:.2f}"), height=min(600, 40 + 24 * len(labels)))
    else:
        st.info("Could not compute similarity matrix.")
else:
    st.info("Need at least 2 items with embeddings to show similarity matrix.")

# --- Visualization Section ---
st.header("Embedding Space Visualization")
st.info("""
- **Show 2D Plot:** Provides a 2-dimensional UMAP projection. Useful for selecting points and seeing primary clusters.
- **Show 3D Plot:** Offers a 3-dimensional UMAP projection. Can sometimes reveal more complex structures but is not interactive for point selection in this version.
""")
if not embeddings_exist:
    if st.session_state.analysis_level == 'Documents':
        st.warning(f"Generate embeddings. Document plotting requires >= {MIN_ITEMS_FOR_PLOT} docs with embeddings.")
    else: # Chunks
        st.warning("Generate embeddings for chunks.")
elif not analysis_service or not visualization_service:
    st.error("Analysis or Visualization Service not available.")
else:
    col1, col2 = st.columns(2)
    plot_title_suffix = st.session_state.analysis_level

    # --- Get Embeddings/Labels for Plotting ---
    embeddings_to_plot = None
    labels_to_plot = []
    source_doc_titles_for_plot = None
    doc_color_map = None # Initialize color map
    color_categories_for_plot = None # Initialize color categories for plot

    if st.session_state.analysis_level == 'Documents':
        # Only consider docs with embeddings for plotting
        docs_with_embeddings = [doc for doc in st.session_state.documents if doc.embedding is not None]
        if len(docs_with_embeddings) >= MIN_ITEMS_FOR_PLOT:
             embeddings_to_plot = np.array([doc.embedding for doc in docs_with_embeddings])
             labels_to_plot = [doc.title for doc in docs_with_embeddings]

             # --- Generate color map for documents ---
             try:
                unique_titles = sorted(list(set(labels_to_plot)))
                color_sequence = px.colors.qualitative.Plotly
                doc_color_map = {title: color_sequence[i % len(color_sequence)] for i, title in enumerate(unique_titles)}
                st.session_state['doc_color_map'] = doc_color_map # Store for table styling
                # For plot: use titles as color category, map provides actual colors
                color_categories_for_plot = labels_to_plot
             except Exception as e:
                  st.error(f"Error generating color map for documents: {e}")
                  color_categories_for_plot = None
                  doc_color_map = None
                  st.session_state.pop('doc_color_map', None)

        # else: plotting buttons will be disabled
    elif st.session_state.analysis_level == 'Chunks':
        embeddings_to_plot = st.session_state.get('all_chunk_embeddings_matrix')
        labels_to_plot = st.session_state.get('all_chunk_labels', [])
        if labels_to_plot:
            # Derive color data from labels stored in session state
            try:
                lookup = st.session_state.get('chunk_label_lookup_dict', {})
                labels_to_plot = st.session_state.get('all_chunk_labels', [])
                source_doc_titles_full = []
                if lookup and labels_to_plot:
                    for label_idx, label in enumerate(labels_to_plot):
                        if label in lookup:
                            item = lookup[label]
                            if isinstance(item, tuple) and len(item) == 2:
                                doc_title = item[1]
                                if isinstance(doc_title, str):
                                    source_doc_titles_full.append(doc_title)
                                else:
                                    st.warning(f"Warning: Document title for chunk label '{label}' is not a string (type: {type(doc_title)}). Skipping for coloring.")
                            else:
                                st.warning(f"Warning: Lookup item for chunk label '{label}' is not a valid (chunk_obj, doc_title) tuple (value: {item}). Skipping for coloring.")
                        else:
                            st.warning(f"Warning: Chunk label '{label}' (index {label_idx}) not found in lookup_dict. Skipping for coloring.")
                color_categories_for_plot = None
                doc_color_map = {} # Initialize as empty dict

                if source_doc_titles_full:
                    color_categories_for_plot = source_doc_titles_full
                    try:
                        # --- Generate color map ---
                        unique_titles = sorted(list(set(source_doc_titles_full)))
                        color_sequence = px.colors.qualitative.Plotly
                        doc_color_map = {title: color_sequence[i % len(color_sequence)] for i, title in enumerate(unique_titles)}
                        st.session_state['doc_color_map'] = doc_color_map # Store in session state
                    except Exception as map_e:
                        st.error(f"Error generating color map: {map_e}")
                        doc_color_map = {} # Reset to empty on error
                        color_categories_for_plot = None
                        st.session_state.pop('doc_color_map', None)
                else:
                    # Failed to get titles, ensure map is empty and state is clear
                    st.warning("Could not derive source document titles for chunk coloring.")
                    doc_color_map = {}
                    color_categories_for_plot = None
                    st.session_state.pop('doc_color_map', None)
            except Exception as e:
                # Catch any other unexpected errors in this block
                st.error(f"Unexpected error during color setup: {e}")
                doc_color_map = {}
                color_categories_for_plot = None
                st.session_state.pop('doc_color_map', None)

    # --- Plotting Buttons ---
    # Ensure we have data before enabling buttons
    can_plot_now = embeddings_to_plot is not None and embeddings_to_plot.shape[0] >= (MIN_ITEMS_FOR_PLOT if st.session_state.analysis_level == 'Documents' else 1)

    with col1:
        if st.button("Show 2D Plot", disabled=not can_plot_now):
            st.session_state.scatter_fig_2d = None
            st.session_state.current_coords_2d = None
            st.session_state.current_labels = []

            if st.session_state.analysis_level == 'Documents' and items_available_for_level < MIN_ITEMS_FOR_PLOT:
                st.error(f"Plotting requires >= {MIN_ITEMS_FOR_PLOT} documents with embeddings.")
            else: # Only proceed if enough items
                try:
                    with st.spinner(f"Reducing {st.session_state.analysis_level.lower()} dimensions to 2D..."):
                        # Ensure embeddings_to_plot is valid before passing
                        # The check in AnalysisService is now primary, but this is a safety layer
                        if embeddings_to_plot is not None and embeddings_to_plot.shape[0] >= (1 if st.session_state.analysis_level == 'Chunks' else MIN_ITEMS_FOR_PLOT):
                             coords_2d = analysis_service.reduce_dimensions(embeddings_to_plot, n_components=2)
                             # Check if reduce_dimensions returned None (due to error or insufficient samples)
                             if coords_2d is None:
                                  st.error("Failed to generate 2D coordinates (check logs for details).")
                                  # Avoid further plotting logic if coords are None
                             else:
                                 st.session_state.current_coords_2d = coords_2d
                                 st.session_state.current_labels = labels_to_plot
                                 # Use the generated color list if plotting chunks
                                 # Pass titles for color categories, and map for colors
                                 color_categories = color_categories_for_plot if st.session_state.analysis_level == 'Chunks' else None
                                 color_map_arg = doc_color_map if st.session_state.analysis_level == 'Chunks' else None

                                 fig_2d = visualization_service.plot_scatter_2d(
                                     coords=coords_2d, labels=labels_to_plot,
                                     title=f"2D UMAP Projection of {plot_title_suffix}", 
                                     color_categories=color_categories, # Pass titles for legend
                                     color_discrete_map=color_map_arg # Pass title->color map
                                 )
                                 st.session_state.scatter_fig_2d = fig_2d
                        else:
                             st.warning("Insufficient data provided for dimensionality reduction.")

                except Exception as e:
                     st.error(f"Error generating 2D plot: {e}")

    with col2:
        if st.button("Show 3D Plot", disabled=not can_plot_now):
            st.session_state.scatter_fig_2d = None # Clear 2D plot state
            st.session_state.current_coords_2d = None
            st.session_state.current_labels = []

            if st.session_state.analysis_level == 'Documents' and items_available_for_level < MIN_ITEMS_FOR_PLOT:
                st.error(f"Plotting requires >= {MIN_ITEMS_FOR_PLOT} documents with embeddings.")
            else: # Only proceed if enough items
                try:
                    with st.spinner(f"Reducing {st.session_state.analysis_level.lower()} dimensions to 3D..."):
                        # Ensure embeddings_to_plot is valid before passing
                        if embeddings_to_plot is not None and embeddings_to_plot.shape[0] >= (1 if st.session_state.analysis_level == 'Chunks' else MIN_ITEMS_FOR_PLOT):
                            coords_3d = analysis_service.reduce_dimensions(embeddings_to_plot, n_components=3)
                            # Check if reduce_dimensions returned None
                            if coords_3d is None:
                                st.error("Failed to generate 3D coordinates (check logs for details).")
                            else:
                                # Use the generated color list if available (handles both levels)
                                color_arg = color_categories_for_plot if st.session_state.analysis_level == 'Chunks' else None
                                fig_3d = visualization_service.plot_scatter_3d(
                                   coords=coords_3d, labels=labels_to_plot,
                                   title=f"3D UMAP Projection of {plot_title_suffix}",
                                   color_data=color_arg # Pass color data
                                )
                                st.plotly_chart(fig_3d, use_container_width=True)
                        else:
                            st.warning("Insufficient data provided for dimensionality reduction.")
                except Exception as e:
                     st.error(f"Error generating 3D plot: {e}")

    # --- Display 2D Plot and Handle Selection (Semantic Center) ---
    if st.session_state.get('scatter_fig_2d') is not None:
         event_data = st.plotly_chart(
             st.session_state.scatter_fig_2d, use_container_width=True,
             on_select="rerun", key="umap_scatter_2d"
         )

         selection = None
         # Check for selection event data using the chart key
         if event_data and event_data.get("selection") and event_data["selection"].get("point_indices"):
             selected_indices = event_data["selection"]["point_indices"]
             if selected_indices:
                 selection = {'indices': selected_indices}
                 print(f"DEBUG: Plot selection detected: Indices {selected_indices}")

         if selection and len(selection['indices']) == 3:
             st.subheader("Triangle Analysis (Plot Selection)")
             st.caption("Currently analyzes a selection of 3 points. This will be generalized to N-simplex analysis in future versions.")
             selected_indices_from_plot = selection['indices']
             current_plot_labels = st.session_state.get('current_labels', []) # Labels shown on the plot

             if current_plot_labels and all(idx < len(current_plot_labels) for idx in selected_indices_from_plot):
                 selected_labels_display = [current_plot_labels[i] for i in selected_indices_from_plot]
                 st.write("**Selected Vertices:**")
                 for i, label in enumerate(selected_labels_display):
                     st.write(f"- {label} (Plot Index: {selected_indices_from_plot[i]})")

                 try:
                     # --- Get High-Dim Data for Analysis ---
                     selected_high_dim_embeddings = [] # Use list for flexibility
                     high_dim_corpus_matrix = None
                     high_dim_corpus_labels = []

                     if st.session_state.analysis_level == 'Documents':
                         docs_map = {doc.title: doc for doc in st.session_state.documents if doc.embedding is not None}
                         selected_docs = [docs_map.get(lbl) for lbl in selected_labels_display]
                         if None in selected_docs or any(doc.embedding is None for doc in selected_docs):
                             st.error("Could not map all selected plot labels back to documents with embeddings.")
                         else:
                             selected_high_dim_embeddings = [doc.embedding for doc in selected_docs]
                             all_docs_with_embeddings = list(docs_map.values())
                             high_dim_corpus_matrix = np.array([doc.embedding for doc in all_docs_with_embeddings])
                             high_dim_corpus_labels = [doc.title for doc in all_docs_with_embeddings]

                     elif st.session_state.analysis_level == 'Chunks':
                         high_dim_corpus_matrix = st.session_state.get('all_chunk_embeddings_matrix')
                         high_dim_corpus_labels = st.session_state.get('all_chunk_labels', [])
                         # Assumes the plot indices directly correspond to the matrix rows
                         if high_dim_corpus_matrix is not None and all(idx < high_dim_corpus_matrix.shape[0] for idx in selected_indices_from_plot):
                             selected_high_dim_embeddings = high_dim_corpus_matrix[selected_indices_from_plot].tolist() # Ensure list
                         else:
                             st.error("Mismatch between plot indices and chunk embedding matrix.")
                             selected_high_dim_embeddings = [] # Mark as invalid

                     # --- Proceed if embeddings found ---
                     if len(selected_high_dim_embeddings) == 3 and high_dim_corpus_matrix is not None and high_dim_corpus_labels:
                         try:
                             mean_high_dim_emb = np.mean(np.array(selected_high_dim_embeddings), axis=0)
                             nn_indices, nn_scores = analysis_service.find_k_nearest(
                                 mean_high_dim_emb, high_dim_corpus_matrix, k=1
                             )

                             if nn_indices is not None and len(nn_indices) > 0:
                                 nearest_neighbor_index = nn_indices[0]
                                 # Check index bounds for safety
                                 if nearest_neighbor_index < len(high_dim_corpus_labels):
                                     nearest_neighbor_label = high_dim_corpus_labels[nearest_neighbor_index]
                                     nearest_neighbor_score = nn_scores[0]
                                     st.write(f"**Semantic Center:** Closest item is **{nearest_neighbor_label}**")
                                     st.write(f"(Similarity Score: {nearest_neighbor_score:.4f})")
                                 else:
                                     st.error("Nearest neighbor index out of bounds!")
                             else:
                                 st.warning("Could not determine the nearest item to the semantic center.")
                         except Exception as analysis_err:
                              st.error(f"Error calculating semantic center: {analysis_err}")
                     else:
                         # Error message already displayed or handled above
                         if not selected_high_dim_embeddings:
                              st.warning("Could not retrieve embeddings for selected points.")
                         elif high_dim_corpus_matrix is None or not high_dim_corpus_labels:
                              st.warning("Corpus embeddings unavailable for analysis.")

                 except Exception as e:
                     st.error(f"Error during plot selection analysis setup: {e}")
             else:
                 st.warning("Selection indices out of bounds or plot labels mismatch.")
         elif selection:
             st.info(f"Select exactly 3 points for triangle analysis (selected {len(selection['indices'])}).")


# --- Document/Chunk Structure Table & Multiselect Analysis ---
with st.expander("View Document/Chunk Structure & Select Chunks for Analysis"):
    if not st.session_state.documents:
        st.write("No documents loaded.")
    else:
        # Check if chunking appears to have run and produced *some* chunks
        # Best check is the presence of chunk labels in session state AFTER embedding
        chunk_labels_exist = 'all_chunk_labels' in st.session_state and st.session_state['all_chunk_labels']

        if not chunk_labels_exist:
             # Check if chunking attribute exists but maybe embedding hasn't run yet
             docs_have_chunks_attr = any(hasattr(doc, 'chunks') for doc in st.session_state.documents)
             if docs_have_chunks_attr:
                 st.info("Chunking run, but embeddings not generated yet (or no embeddings found). Click 'Generate Embeddings'.")
             else:
                  st.info("Run 'Chunk Loaded Documents' first.")
        else: # Chunk labels exist in session state - proceed to display table & multiselect
            # --- Build Table Data --- (Only if chunk labels exist)
            table_data = []
            max_chunks = 0
            doc_titles_in_table = [] # Store original doc titles for styling
            # Build based on actual docs and their chunks attribute
            for doc in st.session_state.documents:
                 if hasattr(doc, 'chunks') and doc.chunks:
                      max_chunks = max(max_chunks, len(doc.chunks))

            if max_chunks > 0: # Ensure we actually have chunks to build the table rows
                for doc in st.session_state.documents:
                    # Store the original title for styling lookup later
                    doc_titles_in_table.append(doc.title)
                    row_data = {'Document': doc.title} # Use original title here
                    if hasattr(doc, 'chunks') and doc.chunks:
                         for i in range(max_chunks):
                             col_name = f"Chunk {i+1}"
                             # Check chunk exists at index i before accessing attribute
                             row_data[col_name] = doc.chunks[i].context_label if i < len(doc.chunks) and doc.chunks[i] else ""
                    else: # Handle docs without chunks attribute or empty chunks list
                         for i in range(max_chunks): row_data[f"Chunk {i+1}"] = "-" # Placeholder
                    table_data.append(row_data)

            # --- Display Table with Styling ---
            if table_data:
                try:
                    df = pd.DataFrame(table_data) # Keep 'Document' as a column

                    # --- Styling Function ---
                    # Retrieve color map, provide empty dict fallback
                    doc_color_map_for_style = st.session_state.get('doc_color_map', {})

                    def get_color_style(doc_title):
                        color = doc_color_map_for_style.get(doc_title, None) # Get color from map
                        return f'background-color: {color}' if color else ''

                    # Apply styling to the 'Document' column using Styler.map
                    st.write("Chunk Overview (Context Labels shown):")
                    st.dataframe(df.style.map(get_color_style, subset=['Document']))

                except Exception as e:
                     st.error(f"Error creating or styling structure table: {e}")
            elif max_chunks == 0:
                # This case means chunk_labels exist, but no docs actually had > 0 chunks
                st.info("Chunking process resulted in 0 chunks across all documents (although labels might exist from a previous run). Re-chunk if needed.")
            else:
                 # This case might indicate an issue if max_chunks > 0 but table_data is empty
                 st.warning("Chunk labels found, but failed to build table data from document chunks.")


            # --- Multiselect Logic (Only if chunk_labels_exist) ---
            # This code runs regardless of whether the table displayed, as long as chunk_labels_exist was true
            chunk_selection_options = st.session_state.get('all_chunk_labels', []) # Already confirmed this exists
            lookup = st.session_state.get('chunk_label_lookup_dict', {})

            st.markdown("---")
            st.subheader("Select 3 Chunks for Table-Based Analysis:")
            selected_chunk_labels = st.multiselect(
                label="Select exactly 3 chunks from the list below:",
                options=chunk_selection_options, key="chunk_multiselect"
            )

            if st.button("Analyze Table Selection", key="analyze_table_button"):
                # Keep existing analysis logic for the button
                if len(selected_chunk_labels) == 3:
                     st.write("**Analyzing Selection from Table:**") # Add confirmation
                     for label in selected_chunk_labels: st.write(f"- {label}")
                     # --- Analysis Logic --- (Assumes previous corrections were okay)
                     try: # <-- Add try/except around analysis
                          selected_chunks = [lookup.get(label) for label in selected_chunk_labels]

                          if None in selected_chunks: # <-- Level A
                               st.error("Could not find data for one or more selected chunk labels.")
                          else: # <-- Level A (Matches 'if None in selected_chunks:')
                              selected_embeddings = [chunk.embedding for chunk in selected_chunks]

                              # Check if all embeddings are valid
                              if all(emb is not None for emb in selected_embeddings): # <-- Level B
                                  mean_high_dim_emb = np.mean(np.array(selected_embeddings), axis=0)
                                  corpus_embeddings_array = st.session_state.get('all_chunk_embeddings_matrix')
                                  corpus_labels = st.session_state.get('all_chunk_labels', [])

                                  # Check 1: Corpus valid?
                                  if corpus_embeddings_array is None or not corpus_labels: # <-- Level C
                                     st.error("Chunk corpus unavailable for KNN search.")
                                  # Check 2: Corpus usable for KNN?
                                  elif corpus_embeddings_array.ndim == 2 and corpus_embeddings_array.shape[0] > 0: # <-- Level C
                                     indices, scores = analysis_service.find_k_nearest(mean_high_dim_emb, corpus_embeddings_array, k=1)
                                     if indices is not None and len(indices) > 0: # <-- Level D
                                         nearest_neighbor_index = indices[0]
                                         if nearest_neighbor_index < len(corpus_labels): # Bounds check
                                              nearest_neighbor_label = corpus_labels[nearest_neighbor_index]
                                              nearest_neighbor_score = scores[0]
                                              st.write(f"**Semantic Center:** Closest item is **{nearest_neighbor_label}**")
                                              st.write(f"(Similarity Score: {nearest_neighbor_score:.4f})")
                                         else:
                                             st.error("Nearest neighbor index out of bounds.")
                                     else: # <-- Level D
                                         st.warning("Could not determine the nearest item to the semantic center.")
                                  # Else for Checks 1 & 2
                                  else: # <-- Level C
                                     st.error("Invalid corpus created for KNN search.")
                              # Else for `if all(emb is not None...)`
                              else: # <-- Level B
                                 st.error("One or more selected chunks lack embeddings.")
                     except Exception as e: # Catch analysis errors
                           st.error(f"An error occurred during table selection analysis: {e}")
                else: # Belongs to if len == 3
                     st.error(f"Please select exactly 3 chunks (you selected {len(selected_chunk_labels)}).")

# --- Manual Simplex Analysis Section ---
st.header("Manual Simplex Analysis")
st.caption("Select 3 items for analysis. This feature will be expanded for more complex selections.")
item_options = []
item_map = {}
current_level = st.session_state.get('analysis_level', 'Documents')

if current_level == 'Documents':
    docs_with_embed = [doc for doc in st.session_state.documents if doc.embedding is not None]
    item_options = [doc.title for doc in docs_with_embed]
    item_map = {doc.title: doc for doc in docs_with_embed}
elif current_level == 'Chunks':
    item_options = st.session_state.get('all_chunk_labels', [])
    item_map = st.session_state.get('chunk_label_lookup_dict', {})

MIN_ITEMS_FOR_SIMPLEX = 3
if len(item_options) < MIN_ITEMS_FOR_SIMPLEX:
    st.info(f"Requires at least {MIN_ITEMS_FOR_SIMPLEX} {current_level.lower()} with embeddings for manual analysis.")
else:
    item1_label = st.selectbox(f"Select Vertex 1 ({current_level[:-1]}):", options=item_options, key="manual_v1", index=0)
    item2_label = st.selectbox(f"Select Vertex 2 ({current_level[:-1]}):", options=item_options, key="manual_v2", index=min(1, len(item_options)-1))
    item3_label = st.selectbox(f"Select Vertex 3 ({current_level[:-1]}):", options=item_options, key="manual_v3", index=min(2, len(item_options)-1))

    if st.button("Analyze Manual Selection", key="analyze_manual_button"):
        selected_labels = [item1_label, item2_label, item3_label]
        if len(set(selected_labels)) != 3:
            st.error("Please select three distinct items.")
        else:
            try:
                selected_embeddings = []
                valid_embeddings = True
                for label in selected_labels:
                    item = item_map.get(label)
                    # Check embedding attribute exists and is not None
                    if item and hasattr(item, 'embedding') and item.embedding is not None:
                        selected_embeddings.append(item.embedding)
                    else:
                        st.error(f"Could not find item or embedding for: '{label}'")
                        valid_embeddings = False; break

                if valid_embeddings:
                    mean_high_dim_emb = np.mean(np.array(selected_embeddings), axis=0)
                    corpus_embeddings_array = None
                    corpus_labels = []

                    if current_level == 'Documents':
                         corpus_items = list(item_map.values()) # Already filtered for embeddings
                         corpus_embeddings_array = np.array([item.embedding for item in corpus_items])
                         corpus_labels = list(item_map.keys())
                    elif current_level == 'Chunks':
                         corpus_embeddings_array = st.session_state.get('all_chunk_embeddings_matrix')
                         corpus_labels = st.session_state.get('all_chunk_labels', [])

                    # Check corpus validity AFTER retrieving it
                    if corpus_embeddings_array is None or not corpus_labels:
                        st.error("Corpus for KNN search unavailable.")
                    elif corpus_embeddings_array.ndim != 2 or corpus_embeddings_array.shape[0] == 0:
                        st.error("Invalid corpus for KNN search (empty or wrong dimensions).")
                    else: # Corpus is valid
                         indices, scores = analysis_service.find_k_nearest(mean_high_dim_emb, corpus_embeddings_array, k=1)
                         if indices is not None and len(indices) > 0:
                              nearest_neighbor_index = indices[0]
                              if nearest_neighbor_index < len(corpus_labels): # Bounds check
                                 nearest_neighbor_label = corpus_labels[nearest_neighbor_index]
                                 nearest_neighbor_score = scores[0]
                                 st.write("**Manual Selection Analysis Results:**")
                                 st.write(f"- Vertex 1: {item1_label}\n- Vertex 2: {item2_label}\n- Vertex 3: {item3_label}")
                                 st.write(f"**Semantic Center:** Closest item is **{nearest_neighbor_label}**")
                                 st.write(f"(Similarity Score: {nearest_neighbor_score:.4f})")
                              else:
                                 st.error("Nearest neighbor index out of bounds.")
                         else:
                              st.warning("Could not determine the nearest item to the semantic center.")
            except Exception as e:
                 st.error(f"An error occurred during manual analysis: {e}")


# --- Nearest Neighbors Analysis Section ---
st.header("Nearest Neighbors Analysis")
if not can_analyze:
    st.warning(f"Generate embeddings for at least 1 {st.session_state.analysis_level.lower()} first for KNN.")
elif not analysis_service:
     st.error("Analysis Service not available.")
else:
    query_options = {}
    num_items = 0

    if st.session_state.analysis_level == 'Documents':
        items_with_embeddings = [doc for doc in st.session_state.documents if doc.embedding is not None]
        num_items = len(items_with_embeddings)
        query_options = {doc.title: doc.title for doc in items_with_embeddings}
    elif st.session_state.analysis_level == 'Chunks':
        chunk_labels = st.session_state.get('all_chunk_labels', [])
        num_items = len(chunk_labels)
        query_options = {label: label for label in chunk_labels}

    if not query_options:
        st.info(f"No {st.session_state.analysis_level.lower()} with embeddings available for KNN query.")
    else:
        selected_key = st.selectbox(f"Select Query {st.session_state.analysis_level[:-1]}:", options=query_options.keys())
        max_k = max(0, num_items - 1)

        if max_k < 1:
             st.warning(f"Need at least 2 {st.session_state.analysis_level.lower()} with embeddings for KNN comparison.")
        else:
            k_neighbors = st.number_input("Number of neighbors (k):", min_value=1, max_value=max_k, value=min(DEFAULT_K, max_k), step=1)

            if st.button("Find Nearest Neighbors"):
                query_emb = None
                query_id = selected_key # Use label/title as ID for self-comparison

                try:
                    # --- Get Query Embedding ---
                    if st.session_state.analysis_level == 'Documents':
                        doc_map = {doc.title: doc for doc in items_with_embeddings} # Use already filtered list
                        query_item_obj = doc_map.get(selected_key)
                        if query_item_obj: query_emb = query_item_obj.embedding
                    elif st.session_state.analysis_level == 'Chunks':
                         lookup = st.session_state.get('chunk_label_lookup_dict', {})
                         query_item_obj = lookup.get(selected_key)
                         if query_item_obj: query_emb = query_item_obj.embedding

                    # --- Perform KNN if Query Embedding Found ---
                    if query_emb is not None:
                        corpus_embeddings = None
                        corpus_labels = []
                        if st.session_state.analysis_level == 'Documents':
                            # Use the already prepared list/map
                             if items_with_embeddings:
                                corpus_embeddings = np.array([d.embedding for d in items_with_embeddings])
                                corpus_labels = [d.title for d in items_with_embeddings]
                        elif st.session_state.analysis_level == 'Chunks':
                            corpus_embeddings = st.session_state.get('all_chunk_embeddings_matrix')
                            corpus_labels = st.session_state.get('all_chunk_labels', [])

                        # Validate corpus before proceeding
                        if corpus_embeddings is None or not corpus_labels or corpus_embeddings.ndim != 2 or corpus_embeddings.shape[0] < 1:
                             st.error(f"Invalid or empty corpus for {st.session_state.analysis_level} KNN search.")
                        else:
                             indices, scores = analysis_service.find_k_nearest(query_emb, corpus_embeddings, k=k_neighbors)

                             st.subheader(f"Top {k_neighbors} neighbors for: {selected_key}")
                             results = []
                             if indices is not None:
                                 # Create a mapping from label/title to its index for efficient self-check if needed
                                 # corpus_id_map = {label: idx for idx, label in enumerate(corpus_labels)}
                                 # query_idx = corpus_id_map.get(query_id)

                                 for idx, score in zip(indices, scores):
                                     # Check bounds just in case
                                     if 0 <= idx < len(corpus_labels):
                                         neighbor_label = corpus_labels[idx]
                                         # find_k_nearest should already exclude self, rely on that
                                         results.append({"Neighbor": neighbor_label, "Similarity Score": f"{score:.4f}"})
                                     else:
                                         st.warning(f"Neighbor index {idx} out of bounds.")

                             if results:
                                 st.table(results)
                             else:
                                 st.write("No distinct neighbors found.")
                    else:
                        st.error(f"Embedding not found for selected query {st.session_state.analysis_level[:-1]} ('{selected_key}').")

                except Exception as e:
                    st.error(f"Error finding nearest neighbors: {e}")
                    st.error(traceback.format_exc()) # Print full traceback for debugging


# --- Semantic Chunk Graph Section ---
st.header("Semantic Chunk Graph")

chunk_matrix_graph = st.session_state.get('all_chunk_embeddings_matrix')
chunk_labels_graph = st.session_state.get('all_chunk_labels')

if chunk_matrix_graph is None or not chunk_labels_graph:
    st.info("Generate embeddings for chunks first to build the semantic graph.")
else:
    graph_mode = st.radio(
        "Graph Construction Mode:",
        options=["Similarity Threshold", "Top-N Neighbors"],
        index=0,
        help="Choose how to construct the semantic graph: by threshold or by top-N neighbors per node."
    )
    similarity_threshold = 0.7
    n_neighbors = 3
    if graph_mode == "Similarity Threshold":
        st.markdown("""
        **Similarity Threshold:**
        
        Use the slider below to control how similar two chunks must be to draw an edge between them in the semantic graph. 
        - **Higher values** (e.g., 0.8+) show only the strongest, most meaningful connections.
        - **Lower values** (e.g., 0.3-0.5) reveal weaker or more distant relationships, resulting in a denser graph.
        
        Adjust this to explore different levels of semantic connectivity in your data.
        """)
        similarity_threshold = st.slider(
            "Similarity Threshold for Graph Edges:",
            min_value=0.1, max_value=1.0, value=0.7, step=0.05, key="graph_threshold"
        )
    else:
        st.markdown("""
        **Top-N Neighbors:**
        
        For each chunk, connect it to its N most similar neighbors (excluding itself). This guarantees every node is connected, even if similarities are low.
        """)
        n_neighbors = st.number_input(
            "Number of Neighbors (N):",
            min_value=1, max_value=max(1, chunk_matrix_graph.shape[0] - 1), value=3, step=1, key="top_n_neighbors"
        )

    if st.button("Show Semantic Graph", key="show_graph_button"):
        labels = st.session_state.get('all_chunk_labels')
        embeddings = st.session_state.get('all_chunk_embeddings_matrix')
        lookup = st.session_state.get('chunk_label_lookup_dict', {})
        source_docs_for_graph = None
        if labels and embeddings is not None and lookup:
            try:
                source_docs_for_graph = [lookup[label][1] for label in labels if label in lookup and isinstance(lookup[label], tuple) and len(lookup[label]) == 2]
                if source_docs_for_graph is not None and len(source_docs_for_graph) != len(labels):
                    st.warning("Graph Coloring: Mismatch creating source_docs_for_graph. Some titles might be missing.")
            except Exception as e:
                st.error(f"Error preparing source_docs_for_graph: {e}")
                source_docs_for_graph = None
        labels_ok = labels and isinstance(labels, list) and len(labels) > 0
        embeddings_ok = embeddings is not None and isinstance(embeddings, np.ndarray) and embeddings.size > 0
        can_generate_graph = labels_ok and embeddings_ok and source_docs_for_graph is not None and len(source_docs_for_graph) == len(labels)
        graph_data = None
        if can_generate_graph:
            with st.spinner(f"Generating graph with mode: {graph_mode}..."):
                if graph_mode == "Similarity Threshold":
                    graph_data = analysis_service.create_semantic_graph(
                        embeddings,
                        labels,
                        source_documents=source_docs_for_graph,
                        similarity_threshold=similarity_threshold
                    )
                else:
                    graph_data = analysis_service.create_top_n_neighbors_graph(
                        embeddings,
                        labels,
                        source_documents=source_docs_for_graph,
                        n_neighbors=n_neighbors
                    )
        elif not (labels_ok and embeddings_ok):
             st.error("DEBUG CHECK: Missing core data for graph generation (embeddings or labels).")
        elif not source_docs_for_graph or (source_docs_for_graph and len(source_docs_for_graph) != len(labels)):
             st.error("DEBUG CHECK: Could not prepare source document information for graph coloring / length mismatch.")
        semantic_graph, graph_metrics, communities = None, {}, None
        node_degrees, node_betweenness = {}, {}
        if graph_data:
            if len(graph_data) == 3:
                 semantic_graph, graph_metrics, communities = graph_data
                 node_degrees = graph_metrics.get('degrees', {})
                 node_betweenness = graph_metrics.get('betweenness', {})
                 # --- UPDATE SESSION STATE KNOWLEDGE GRAPH INSTANCE ---
                 if semantic_graph is not None:
                     if 'knowledge_graph_instance' in st.session_state and st.session_state.knowledge_graph_instance is not None:
                         st.session_state.knowledge_graph_instance.graph = semantic_graph # Assign the nx.Graph
                         st.session_state.knowledge_graph_instance.nodes = {} # Clear old model nodes
                         st.session_state.knowledge_graph_instance.edges = {} # Clear old model edges
                         st.write("DEBUG: Updated knowledge_graph_instance in session state.")
                     else:
                         st.warning("DEBUG: knowledge_graph_instance not found in session state to update.")
            else:
                 st.error("DEBUG: Graph generation service returned unexpected data format.")
        if semantic_graph:
            if semantic_graph.number_of_nodes() > 0:
                st.success(f"Generated graph with {semantic_graph.number_of_nodes()} nodes and {semantic_graph.number_of_edges()} edges.")
                try:
                    if semantic_graph.number_of_nodes() < 150:
                        pydot_graph_original = nx.nx_pydot.to_pydot(semantic_graph)
                        pydot_graph_original.set_graph_defaults(overlap='scale', sep='+5', splines='true')
                        pydot_graph_original.set_node_defaults(shape='ellipse', style='filled')
                        pydot_graph_original.set_prog('neato')
                        try:
                            dot_string_original = pydot_graph_original.to_string()
                            st.graphviz_chart(dot_string_original)
                            st.success("Original graph (with color attributes and edges) rendered via st.graphviz_chart!")
                        except Exception as graphviz_render_error:
                            st.error(f"ERROR during st.graphviz_chart with original graph: {graphviz_render_error}")
                            st.code(traceback.format_exc())
                    else:
                         st.info(f"Graph too large ({semantic_graph.number_of_nodes()} nodes) for Graphviz.")
                except ImportError:
                    st.warning("Graphviz / pydot not installed. Cannot display static graph. Ensure `pydot` is in requirements.txt")
                except AttributeError as e:
                    st.warning(f"Could not render graph via pydot. Is `pydot` installed correctly? Error: {e}")
                except Exception as viz_error:
                    st.error(f"Error rendering graph: {viz_error}")
                    st.code(traceback.format_exc())