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

embedding_service = load_embedding_service()
analysis_service = load_analysis_service()
visualization_service = load_visualization_service()
chunker = load_chunker(embedding_service, analysis_service)

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


# --- Streamlit App UI ---
st.title("Voronoi5 - Document Analysis Tool")

# Sidebar for Loading and Options
st.sidebar.header("Document Loading")

uploaded_files = st.sidebar.file_uploader(
    "Upload Documents (TXT or PDF)",
    type=['txt', 'pdf'],
    accept_multiple_files=True,
    key="file_uploader" # Add key to help Streamlit manage state
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
            st.rerun()
    else:
        st.sidebar.warning("No files selected in the uploader to process.")

if st.sidebar.button("Clear All Documents"):
    reset_derived_data(clear_docs=True)
    st.sidebar.info("All loaded documents and data cleared.")
    st.rerun()

st.sidebar.caption("Use the 'x' in the uploader UI to remove selected files before processing.")

if not st.session_state.documents:
    st.info("Upload documents and click 'Process Uploaded Files' to begin.")
    st.stop()

# --- Processing Section ---
st.sidebar.header("Processing")

# Chunking Button
if st.sidebar.button("Chunk Loaded Documents", disabled=not chunker):
    if chunker and st.session_state.documents:
        updated_documents = []
        error_occurred = False
        # --- Main Try Block for Chunking ---
        try: # <--- Indent Level 1
            with st.spinner("Chunking documents..."):
                for doc in st.session_state.documents:
                    try: # <-- Indent Level 2 (Inner Try)
                        if not hasattr(doc, 'chunks'): doc.chunks = []
                        doc.chunks = chunker.chunk_document(doc)
                        updated_documents.append(doc)
                    except Exception as e: # <-- Indent Level 2 (Matches Inner Try)
                         st.sidebar.error(f"Error chunking doc '{doc.title}': {e}")
                         updated_documents.append(doc) # Keep original doc on error
                         error_occurred = True

            st.session_state.documents = updated_documents # Update state inside try
            msg = f"Chunking complete for {len(st.session_state.documents)} documents."
            if error_occurred:
                st.sidebar.warning(msg + " (with errors)")
            else:
                st.sidebar.success(msg)

        except Exception as e: # <--- Indent Level 1 (Matches Outer Try)
            st.sidebar.error(f"An unexpected error occurred during chunking: {e}")
            error_occurred = True # Ensure error is flagged if outer try fails

            # Reset state and rerun AFTER try/except finishes
            # Only reset embeddings if chunking didn't completely fail
            if not error_occurred or updated_documents: # Avoid reset if initial error prevented any updates
                 reset_derived_data(clear_docs=False)
            st.rerun()

    elif not chunker:
         st.sidebar.error("Chunking Service not available.")
    else:
        st.sidebar.warning("No documents loaded to chunk.")

# Embedding Button
if st.sidebar.button("Generate Embeddings", disabled=not embedding_service):
    if embedding_service and st.session_state.documents:
        try:
            with st.spinner("Generating embeddings for documents and chunks..."):
                docs_processed_count = 0
                chunks_processed_count = 0
                error_occurred = False
                updated_documents = list(st.session_state.documents) # Work on a copy

                for i, doc in enumerate(updated_documents):
                    # 1. Process Document Embedding
                    if doc.embedding is None:
                        try:
                            doc.embedding = embedding_service.generate_embedding(doc.content)
                            if doc.embedding is not None: docs_processed_count += 1
                        except Exception as e:
                            st.sidebar.error(f"Error embedding doc '{doc.title}': {e}")
                            error_occurred = True
                            continue # Skip to next doc if doc embedding fails

                    # 2. Process Chunk Embeddings (if chunks exist)
                    if hasattr(doc, 'chunks') and doc.chunks:
                        for chunk_idx, chunk in enumerate(doc.chunks):
                            if chunk.embedding is None:
                                try:
                                    chunk.embedding = embedding_service.generate_embedding(chunk.content)
                                    if chunk.embedding is not None: chunks_processed_count += 1
                                except Exception as e:
                                    st.sidebar.error(f"Error embedding chunk {chunk_idx} in doc '{doc.title}': {e}")
                                    error_occurred = True
                                    # Optionally, decide if you want to stop all embedding for this doc or continue with other chunks
                    updated_documents[i] = doc # Update the document in the list

                st.session_state.documents = updated_documents # Update session state with processed documents

                # After processing all documents and their chunks, consolidate chunk embeddings
                all_chunk_embeddings = []
                all_chunk_labels = []
                chunk_label_lookup_dict = {} # For debugging and easier lookup

                for doc_idx, doc in enumerate(st.session_state.documents):
                    if hasattr(doc, 'chunks') and doc.chunks:
                        for chunk_idx, chunk in enumerate(doc.chunks):
                            if chunk.embedding is not None:
                                all_chunk_embeddings.append(chunk.embedding)
                                label = f"{doc.title}_Chunk{chunk_idx+1}"
                                all_chunk_labels.append(label)
                                # Store index mapping: original doc_idx, chunk_idx to its position in the flat list
                                chunk_label_lookup_dict[label] = {'doc_index': doc_idx, 'chunk_index': chunk_idx, 'flat_list_index': len(all_chunk_embeddings)-1}


                if all_chunk_embeddings:
                    st.session_state.all_chunk_embeddings_matrix = np.array(all_chunk_embeddings)
                    st.session_state.all_chunk_labels = all_chunk_labels
                    st.session_state.chunk_label_lookup_dict = chunk_label_lookup_dict # Save for potential use

                    # --- START DEBUG EMBEDDING ---
                    # st.sidebar.write("--- DEBUG EMBEDDING ---")
                    # matrix_shape_debug = st.session_state.all_chunk_embeddings_matrix.shape if st.session_state.all_chunk_embeddings_matrix is not None else "None"
                    # labels_len_debug = len(st.session_state.all_chunk_labels) if st.session_state.all_chunk_labels is not None else "None"
                    # lookup_len_debug = len(st.session_state.chunk_label_lookup_dict) if st.session_state.chunk_label_lookup_dict is not None else "None"
                    # st.sidebar.write(f"Post-consolidation: Matrix shape: {matrix_shape_debug}, Labels len: {labels_len_debug}, Lookup len: {lookup_len_debug}")
                    # if st.session_state.all_chunk_labels and isinstance(st.session_state.all_chunk_labels, list) and len(st.session_state.all_chunk_labels) > 0:
                    #    st.sidebar.write(f"First label: {st.session_state.all_chunk_labels[0]}")
                    # if st.session_state.chunk_label_lookup_dict and isinstance(st.session_state.chunk_label_lookup_dict, dict) and len(st.session_state.chunk_label_lookup_dict) > 0:
                    #    st.sidebar.write(f"First lookup entry example (first key): {list(st.session_state.chunk_label_lookup_dict.keys())[0]}")
                    # st.sidebar.write("--- END DEBUG ---")
                    # --- END DEBUG EMBEDDING ---
                else:
                    st.session_state.all_chunk_embeddings_matrix = None # Ensure it's reset if no chunks
                    st.session_state.all_chunk_labels = []
                    st.session_state.chunk_label_lookup_dict = {}


                st.session_state.embeddings_generated = True
                msg = f"Embeddings generated for {docs_processed_count} documents and {chunks_processed_count} chunks."
                if error_occurred:
                    st.sidebar.warning(msg + " (with errors)")
                else:
                    st.sidebar.success(msg)

                # Clear any previous plot data as embeddings have changed
                st.session_state.scatter_fig_2d = None
                st.session_state.current_coords_2d = None
                st.session_state.current_labels = []
                st.session_state.coords_3d = None
                st.rerun()

        except Exception as e:
            st.sidebar.error(f"An unexpected error occurred during embedding generation: {e}")
            # Potentially reset parts of the state if a major failure occurs
            reset_derived_data(clear_docs=False) # Reset relevant parts
            st.rerun() # Rerun to reflect state changes
    elif not embedding_service:
        st.sidebar.error("Embedding Service not available.")
    else:
        st.sidebar.warning("No documents loaded to generate embeddings for.")

# --- Main Area Logic ---
st.header("Analysis Configuration")
analysis_level = st.radio(
    "Analyze/Visualize Level:", ('Documents', 'Chunks'), key='analysis_level', horizontal=True
)

# Check if embeddings exist at the required level
embeddings_exist = False
items_available_for_level = 0
can_analyze = False # Flag to check if enough data for analysis exists

if st.session_state.get('embeddings_generated'):
    if analysis_level == 'Documents':
        items_available_for_level = sum(1 for doc in st.session_state.documents if doc.embedding is not None)
        if items_available_for_level >= MIN_ITEMS_FOR_PLOT:
            embeddings_exist = True # Enough docs with embeddings for plotting
        if items_available_for_level >= 1: # Need at least 1 for analysis
             can_analyze = True
    elif analysis_level == 'Chunks':
        # Check the matrix directly
        chunk_matrix = st.session_state.get('all_chunk_embeddings_matrix')
        if chunk_matrix is not None and chunk_matrix.shape[0] > 0:
             items_available_for_level = chunk_matrix.shape[0]
             embeddings_exist = True # Embeddings generated if matrix exists and is not empty
             can_analyze = True

# --- Visualization Section ---
st.header("Embedding Space Visualization")
if not embeddings_exist:
    if analysis_level == 'Documents':
        st.warning(f"Generate embeddings. Document plotting requires >= {MIN_ITEMS_FOR_PLOT} docs with embeddings.")
    else: # Chunks
        st.warning("Generate embeddings for chunks.")
elif not analysis_service or not visualization_service:
    st.error("Analysis or Visualization Service not available.")
else:
    col1, col2 = st.columns(2)
    plot_title_suffix = analysis_level

    # --- Get Embeddings/Labels for Plotting ---
    embeddings_to_plot = None
    labels_to_plot = []
    source_doc_titles_for_plot = None
    doc_color_map = None # Initialize color map
    color_categories_for_plot = None # Initialize color categories for plot

    if analysis_level == 'Documents':
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
    elif analysis_level == 'Chunks':
        embeddings_to_plot = st.session_state.get('all_chunk_embeddings_matrix')
        labels_to_plot = st.session_state.get('all_chunk_labels', [])
        if labels_to_plot:
            # Derive color data from labels stored in session state
            try:
                lookup = st.session_state.get('chunk_label_lookup_dict', {})
                labels_to_plot = st.session_state.get('all_chunk_labels', [])
                source_doc_titles_full = []
                color_categories_for_plot = None
                doc_color_map = {} # Initialize as empty dict

                if lookup and labels_to_plot:
                     # Extract the stored doc.title (element 1 of the tuple) from the lookup
                     try:
                          # Ensure label exists in lookup before accessing
                          source_doc_titles_full = [lookup[label][1] for label in labels_to_plot if label in lookup]
                     except (KeyError, IndexError, TypeError) as e:
                          st.error(f"Error accessing titles from lookup: {e}")
                          source_doc_titles_full = [] # Reset on error

                # Proceed only if we successfully extracted titles
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
    can_plot_now = embeddings_to_plot is not None and embeddings_to_plot.shape[0] >= (MIN_ITEMS_FOR_PLOT if analysis_level == 'Documents' else 1)

    with col1:
        if st.button("Show 2D Plot", disabled=not can_plot_now):
            st.session_state.scatter_fig_2d = None
            st.session_state.current_coords_2d = None
            st.session_state.current_labels = []

            if analysis_level == 'Documents' and items_available_for_level < MIN_ITEMS_FOR_PLOT:
                st.error(f"Plotting requires >= {MIN_ITEMS_FOR_PLOT} documents with embeddings.")
            else: # Only proceed if enough items
                try:
                    with st.spinner(f"Reducing {analysis_level.lower()} dimensions to 2D..."):
                        # Ensure embeddings_to_plot is valid before passing
                        # The check in AnalysisService is now primary, but this is a safety layer
                        if embeddings_to_plot is not None and embeddings_to_plot.shape[0] >= (1 if analysis_level == 'Chunks' else MIN_ITEMS_FOR_PLOT):
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
                                 color_categories = color_categories_for_plot if analysis_level == 'Chunks' else None
                                 color_map_arg = doc_color_map if analysis_level == 'Chunks' else None

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

            if analysis_level == 'Documents' and items_available_for_level < MIN_ITEMS_FOR_PLOT:
                st.error(f"Plotting requires >= {MIN_ITEMS_FOR_PLOT} documents with embeddings.")
            else: # Only proceed if enough items
                try:
                    with st.spinner(f"Reducing {analysis_level.lower()} dimensions to 3D..."):
                        # Ensure embeddings_to_plot is valid before passing
                        if embeddings_to_plot is not None and embeddings_to_plot.shape[0] >= (1 if analysis_level == 'Chunks' else MIN_ITEMS_FOR_PLOT):
                            coords_3d = analysis_service.reduce_dimensions(embeddings_to_plot, n_components=3)
                            # Check if reduce_dimensions returned None
                            if coords_3d is None:
                                st.error("Failed to generate 3D coordinates (check logs for details).")
                            else:
                                # Use the generated color list if available (handles both levels)
                                color_arg = color_categories_for_plot if analysis_level == 'Chunks' else None
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

                     if analysis_level == 'Documents':
                         docs_map = {doc.title: doc for doc in st.session_state.documents if doc.embedding is not None}
                         selected_docs = [docs_map.get(lbl) for lbl in selected_labels_display]
                         if None in selected_docs or any(doc.embedding is None for doc in selected_docs):
                             st.error("Could not map all selected plot labels back to documents with embeddings.")
                         else:
                             selected_high_dim_embeddings = [doc.embedding for doc in selected_docs]
                             all_docs_with_embeddings = list(docs_map.values())
                             high_dim_corpus_matrix = np.array([doc.embedding for doc in all_docs_with_embeddings])
                             high_dim_corpus_labels = [doc.title for doc in all_docs_with_embeddings]

                     elif analysis_level == 'Chunks':
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
    st.warning(f"Generate embeddings for at least 1 {analysis_level.lower()} first for KNN.")
elif not analysis_service:
     st.error("Analysis Service not available.")
else:
    query_options = {}
    num_items = 0

    if analysis_level == 'Documents':
        items_with_embeddings = [doc for doc in st.session_state.documents if doc.embedding is not None]
        num_items = len(items_with_embeddings)
        query_options = {doc.title: doc.title for doc in items_with_embeddings}
    elif analysis_level == 'Chunks':
        chunk_labels = st.session_state.get('all_chunk_labels', [])
        num_items = len(chunk_labels)
        query_options = {label: label for label in chunk_labels}

    if not query_options:
        st.info(f"No {analysis_level.lower()} with embeddings available for KNN query.")
    else:
        selected_key = st.selectbox(f"Select Query {analysis_level[:-1]}:", options=query_options.keys())
        max_k = max(0, num_items - 1)

        if max_k < 1:
             st.warning(f"Need at least 2 {analysis_level.lower()} with embeddings for KNN comparison.")
        else:
            k_neighbors = st.number_input("Number of neighbors (k):", min_value=1, max_value=max_k, value=min(DEFAULT_K, max_k), step=1)

            if st.button("Find Nearest Neighbors"):
                query_emb = None
                query_id = selected_key # Use label/title as ID for self-comparison

                try:
                    # --- Get Query Embedding ---
                    if analysis_level == 'Documents':
                        doc_map = {doc.title: doc for doc in items_with_embeddings} # Use already filtered list
                        query_item_obj = doc_map.get(selected_key)
                        if query_item_obj: query_emb = query_item_obj.embedding
                    elif analysis_level == 'Chunks':
                         lookup = st.session_state.get('chunk_label_lookup_dict', {})
                         query_item_obj = lookup.get(selected_key)
                         if query_item_obj: query_emb = query_item_obj.embedding

                    # --- Perform KNN if Query Embedding Found ---
                    if query_emb is not None:
                        corpus_embeddings = None
                        corpus_labels = []
                        if analysis_level == 'Documents':
                            # Use the already prepared list/map
                             if items_with_embeddings:
                                corpus_embeddings = np.array([d.embedding for d in items_with_embeddings])
                                corpus_labels = [d.title for d in items_with_embeddings]
                        elif analysis_level == 'Chunks':
                            corpus_embeddings = st.session_state.get('all_chunk_embeddings_matrix')
                            corpus_labels = st.session_state.get('all_chunk_labels', [])

                        # Validate corpus before proceeding
                        if corpus_embeddings is None or not corpus_labels or corpus_embeddings.ndim != 2 or corpus_embeddings.shape[0] < 1:
                             st.error(f"Invalid or empty corpus for {analysis_level} KNN search.")
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
                        st.error(f"Embedding not found for selected query {analysis_level[:-1]} ('{selected_key}').")

                except Exception as e:
                    st.error(f"Error finding nearest neighbors: {e}")
                    import traceback
                    st.error(traceback.format_exc()) # Print full traceback for debugging


# --- Semantic Chunk Graph Section --- (Place appropriately in UI logic)
st.header("Semantic Chunk Graph")

# Check prerequisites
# Use the keys for the centralized chunk data
chunk_matrix_graph = st.session_state.get('all_chunk_embeddings_matrix')
chunk_labels_graph = st.session_state.get('all_chunk_labels')
analysis_service = load_analysis_service() # Ensure service is loaded

# Initialize graph-related variables outside the button click
semantic_graph, graph_metrics, communities = None, {}, None
node_degrees, node_betweenness = {}, {}

if chunk_matrix_graph is None or not chunk_labels_graph:
    st.info("Generate embeddings for chunks first to build the semantic graph.")
elif not analysis_service:
    st.error("Analysis Service not available.")
else:
    # UI Elements
    similarity_threshold = st.slider(
        "Similarity Threshold for Graph Edges:",
        min_value=0.1, max_value=1.0, value=0.7, step=0.05, key="graph_threshold"
    )

    if st.button("Show Semantic Graph", key="show_graph_button"):
         # Retrieve data from session state (already checked existence)
         labels = st.session_state.get('all_chunk_labels') # Short labels
         embeddings = st.session_state.get('all_chunk_embeddings_matrix')
         lookup = st.session_state.get('chunk_label_lookup_dict', {}) # {short_label: (chunk_obj, doc_title)}
         source_docs_for_graph = None # Initialize

         if labels and embeddings is not None and lookup:
              try:
                  # Derive source documents reliably using the lookup dict
                  source_docs_for_graph = [lookup[label][1] for label in labels if label in lookup]
                  # Basic validation
                  if len(source_docs_for_graph) != len(labels):
                       st.warning("Mismatch generating source doc list for graph. Coloring might be inaccurate.")
                       source_docs_for_graph = [label.split('::')[0] for label in labels] # Fallback
              except Exception as e:
                   st.error(f"Failed to prepare source document list for graph coloring: {e}")
                   source_docs_for_graph = None

         graph_data = None
         if labels and embeddings is not None and source_docs_for_graph:
             with st.spinner(f"Generating graph with threshold {similarity_threshold}..."):
                 graph_data = analysis_service.create_semantic_graph(
                     embeddings,
                     labels, 
                     source_documents=source_docs_for_graph, 
                     similarity_threshold=similarity_threshold
                 )
         elif not (labels and embeddings and lookup):
             st.error("Chunk embedding data (labels, matrix, or lookup) is missing. Please regenerate embeddings.")
         elif not source_docs_for_graph:
             pass 

         # Unpack graph_data if it was successfully generated
         if graph_data: 
             if len(graph_data) == 3:
                  semantic_graph, graph_metrics, communities = graph_data 
                  node_degrees = graph_metrics.get('degrees', {})
                  node_betweenness = graph_metrics.get('betweenness', {})
             else:
                  st.error("Graph generation service returned unexpected data format.")
                  # Reset to ensure clean state if unpacking failed
                  semantic_graph, graph_metrics, communities = None, {}, None
                  node_degrees, node_betweenness = {}, {}
         elif labels and embeddings is not None and source_docs_for_graph: # graph_data is None but inputs were ok
             st.error("Failed to generate semantic graph data from service (service returned None).")
             # Reset to ensure clean state
             semantic_graph, graph_metrics, communities = None, {}, None
             node_degrees, node_betweenness = {}, {}

    # Display graph and metrics if semantic_graph is not None
    # This section will now always have node_degrees and node_betweenness initialized
    if semantic_graph:
        if semantic_graph.number_of_nodes() > 0:
            st.success(f"Generated graph with {semantic_graph.number_of_nodes()} nodes and {semantic_graph.number_of_edges()} edges.")
            # --- Visualization Option: Graphviz (Static, with COLOR) ---
            try:
                if semantic_graph.number_of_nodes() < 150:
                    pydot_graph = nx.nx_pydot.to_pydot(semantic_graph)
                    pydot_graph.set_graph_defaults(overlap='scale', sep='+5', splines='true')
                    pydot_graph.set_node_defaults(shape='ellipse')
                    pydot_graph.set_prog('neato')
                    st.graphviz_chart(pydot_graph.to_string())
                else:
                    st.info(f"Graph too large ({semantic_graph.number_of_nodes()} nodes) for direct Graphviz visualization.")
            except ImportError:
                st.warning("Graphviz / pydot not installed. Cannot display static graph. Ensure `pydot` is in requirements.txt")
            except AttributeError as e:
                st.warning(f"Could not render graph via pydot. Is `pydot` installed correctly? Error: {e}")
            except Exception as viz_error:
                st.error(f"Error rendering graph: {viz_error}")

            # --- Display Top N Degrees ---
            if node_degrees:
                st.subheader("Top Connected Chunks (Highest Degree)")
                sorted_degrees = sorted(node_degrees.items(), key=lambda item: item[1], reverse=True)
                top_n = 10
                degrees_to_display = sorted_degrees[:top_n]
                if not degrees_to_display or all(deg == 0 for _, deg in degrees_to_display):
                    st.info("No nodes with connections found at this threshold.")
                else:
                    degree_data = [{"Chunk Label": label, "Degree (Connections)": degree}
                                   for label, degree in degrees_to_display if degree > 0]
                    if degree_data:
                        degree_df = pd.DataFrame(degree_data)
                        st.dataframe(degree_df, use_container_width=True, hide_index=True)
                    else:
                        st.info("Top nodes have 0 connections at this threshold.")
            else:
                st.warning("Node degrees were not calculated.")

            # --- Display Top N Betweenness ---
            if node_betweenness:
                 st.subheader("Top Bridge Chunks (Highest Betweenness Centrality)")
                 # Sort betweenness by value descending
                 sorted_betweenness = sorted(node_betweenness.items(), key=lambda item: item[1], reverse=True)

                 # Display top N (e.g., 10)
                 top_n_bw = 10
                 betweenness_to_display = sorted_betweenness[:top_n_bw]

                 if not betweenness_to_display or all(bw == 0 for _, bw in betweenness_to_display):
                      st.info("No significant bridge nodes found (betweenness centrality is zero or near zero).")
                 else:
                      # Prepare data for table display
                      betweenness_data = [{
                          "Chunk Label": label,
                          "Betweenness Centrality": f"{centrality:.4f}" # Format for display
                      } for label, centrality in betweenness_to_display if centrality > 0] # Only show if > 0

                      if betweenness_data:
                           betweenness_df = pd.DataFrame(betweenness_data)
                           st.dataframe(betweenness_df, use_container_width=True, hide_index=True)
                      else:
                            st.info("Top nodes have zero betweenness centrality.")
            else:
                st.warning("Betweenness centrality was not calculated.")
            # --- End Betweenness Display ---

            # --- Display Detected Communities ---
            if communities is not None: # Check if community detection ran successfully
                 st.subheader(f"Detected Communities ({len(communities)})")
                 if not communities:
                      st.info("No distinct communities found at this threshold/resolution.")
                 else:
                      # Sort communities by size (descending) for display
                      communities.sort(key=len, reverse=True)
                      for i, community_set in enumerate(communities):
                           community_list = sorted(list(community_set)) # Sort members alphabetically
                           with st.expander(f"Community {i+1} ({len(community_list)} members)"):
                                # Display first N members for brevity
                                max_members_to_show = 15
                                st.write(community_list[:max_members_to_show])
                                if len(community_list) > max_members_to_show:
                                     st.caption("... (more members hidden)")
            elif communities is None:
                 # Explicit message if detection failed (e.g., missing library)
                 st.warning("Community detection did not run (check logs/dependencies like 'python-louvain').")
            # --- End Community Display ---

            st.markdown("---") 
        else:
            st.info("Graph generated but has no nodes or edges (check threshold and data).")
         # If semantic_graph is None, an error was already shown above.

# --- Display loaded documents details ---
with st.expander("View Loaded Documents", expanded=False):
    if st.session_state.documents:
        for i, doc in enumerate(st.session_state.documents):
            embed_status = "Yes" if doc.embedding is not None else "No"
            st.markdown(f"**{i+1}. {doc.title}** - Doc Embedding: {embed_status}")

            if hasattr(doc, 'chunks') and doc.chunks:
                chunk_embed_counts = sum(1 for chunk in doc.chunks if chunk.embedding is not None)
                st.markdown(f"    Chunks: {len(doc.chunks)} ({chunk_embed_counts} embedded)")
            elif hasattr(doc, 'chunks'): # Chunking ran but yielded 0
                 st.markdown("    Chunks: 0")
            else: # Chunking not run
                 st.markdown("    Chunks: Not Processed")
            st.divider()
    else:
        st.write("No documents loaded.")

# --- (Optional) Computational Matrices Info Expander ---
with st.expander("View Computational Matrices Info", expanded=False):
    # Check chunk matrix exists in session state and is not None
    chunk_matrix = st.session_state.get('all_chunk_embeddings_matrix')
    if chunk_matrix is not None:
        st.write(f"**Chunk Embedding Matrix:**")
        st.write(f"- Shape: {chunk_matrix.shape}")
        st.write(f"- Number of Chunks: {len(st.session_state.get('all_chunk_labels', []))}")

        if st.button("Compute & Show Similarity Matrix Info"):
            if analysis_service:
                sim_matrix = analysis_service.calculate_similarity_matrix(chunk_matrix)
                if sim_matrix is not None:
                    st.write(f"**Chunk Similarity Matrix:**")
                    st.write(f"- Shape: {sim_matrix.shape}")
                    # Display heatmap only if few chunks
                    if sim_matrix.shape[0] > 0 and sim_matrix.shape[0] < 25:
                         try:
                              import plotly.express as px
                              fig = px.imshow(sim_matrix, text_auto=".2f", aspect="auto",
                                                labels=dict(x="Chunk Index", y="Chunk Index", color="Similarity"),
                                                # Use short labels for heatmap axes if possible
                                                # x=st.session_state.get('all_chunk_labels', []),
                                                # y=st.session_state.get('all_chunk_labels', []),
                                                title="Chunk Similarity Matrix Heatmap")
                              fig.update_xaxes(side="top", tickangle=45)
                              st.plotly_chart(fig)
                         except ImportError:
                              st.warning("Plotly Express not found. Cannot display heatmap.")
                         except Exception as e:
                              st.error(f"Failed to generate similarity heatmap: {e}")
                    elif sim_matrix.shape[0] >= 25:
                         st.info(f"Similarity matrix ({sim_matrix.shape[0]}x{sim_matrix.shape[0]}) too large for heatmap.")
                    # else: matrix is empty, do nothing
                else:
                    st.error("Failed to compute similarity matrix.")
            else:
                st.error("Analysis Service not available.")
    else:
        st.info("Chunk embedding matrix not yet generated. Please generate embeddings.")