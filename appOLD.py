import streamlit as st
import numpy as np
import os
import io # Added io
import pandas as pd # Added pandas import
from typing import List, Tuple, Optional
from PyPDF2 import PdfReader # Corrected capitalization

# Project Modules
from models.document import Document
from models.chunk import Chunk
from services.embedding_service import EmbeddingService
from services.analysis_service import AnalysisService
from services.visualization_service import VisualizationService
from services.chunking_service import ContextualChunker

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
        'coords_3d': None, # Added missing init
        # Removed duplicate initializations below
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

initialize_session_state()

# --- Helper Functions ---
# get_all_embeddings() removed as it's likely superseded by stored matrices

def reset_derived_data(clear_docs=False):
    """Clears embeddings, chunks, derived data. Optionally clears documents too."""
    if clear_docs:
        st.session_state.documents = []
    else:
        for doc in st.session_state.documents:
            doc.embedding = None
            if hasattr(doc, 'chunks'):
                doc.chunks = []

    st.session_state.embeddings_generated = False
    st.session_state.coords_2d = None
    st.session_state.coords_3d = None
    st.session_state.all_chunk_embeddings_matrix = None
    st.session_state.all_chunk_labels = []
    st.session_state.chunk_label_lookup_dict = {} # Clear lookup dict too
    st.session_state.analysis_level = 'Documents'
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
        try:
            with st.spinner("Chunking documents..."):
                for doc in st.session_state.documents:
                    try:
                        if not hasattr(doc, 'chunks'): doc.chunks = []
                        doc.chunks = chunker.chunk_document(doc)
                        updated_documents.append(doc)
                    except Exception as e:
                         st.sidebar.error(f"Error chunking doc '{doc.title}': {e}")
                         updated_documents.append(doc) # Keep original doc on error
                         error_occurred = True

            st.session_state.documents = updated_documents
            msg = f"Chunking complete for {len(st.session_state.documents)} documents."
            if error_occurred:
                st.sidebar.warning(msg + " (with errors)")
            else:
                st.sidebar.success(msg)

        except Exception as e:
            st.sidebar.error(f"An unexpected error occurred during chunking: {e}")

        # --- Code AFTER try...except block ---

        # --- START DEBUG CHUNKING ---
        st.sidebar.write("--- DEBUG CHUNKING ---")
        for i_debug, doc_debug in enumerate(st.session_state.documents):
            chunk_count_debug = len(doc_debug.chunks) if hasattr(doc_debug, 'chunks') and doc_debug.chunks is not None else 0
            st.sidebar.write(f"Doc {i_debug+1} ('{doc_debug.title[:20]}...'): {chunk_count_debug} chunks found.")
        st.sidebar.write("--- END DEBUG ---")
        # --- END DEBUG CHUNKING ---

        # Reset state and rerun AFTER try/except finishes
        reset_derived_data(clear_docs=False) # Reset embeddings/matrices after chunking attempt
        st.rerun() # Rerun regardless of chunking success/failure

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
                    doc_updated = False
                    # 1. Process Document Embedding
                    if doc.embedding is None:
                        try:
                            doc.embedding = embedding_service.generate_embedding(doc.content)
                            if doc.embedding is not None:
                                docs_processed_count += 1
                                doc_updated = True
                        except Exception as e:
                            st.sidebar.error(f"Error embedding doc '{doc.title}': {e}")
                            error_occurred = True

                    # 2. Process Chunk Embeddings (if chunks exist)
                    if hasattr(doc, 'chunks') and doc.chunks:
                        for j, chunk in enumerate(doc.chunks):
                            if chunk.embedding is None:
                                try:
                                    chunk.embedding = embedding_service.generate_embedding(chunk.content)
                                    if chunk.embedding is not None:
                                        chunks_processed_count += 1
                                        doc_updated = True # Mark doc as updated if any chunk was processed
                                except Exception as e:
                                    st.sidebar.error(f"Error embedding chunk {j+1} in doc '{doc.title}': {e}")
                                    error_occurred = True

                # Update session state with potentially modified documents
                st.session_state.documents = updated_documents

            # --- Post-processing: Create and store chunk matrix ---
            all_chunk_embeddings_list = []
            all_chunk_labels_list = []
            chunk_label_to_object_lookup = {}
            print("Consolidating chunk embeddings into matrix and creating lookup...")
            if st.session_state.documents:
                for doc in st.session_state.documents:
                     if hasattr(doc, 'chunks') and doc.chunks:
                         for i, chunk in enumerate(doc.chunks):
                             if chunk.embedding is not None:
                                 all_chunk_embeddings_list.append(chunk.embedding)
                                 label = f"{doc.title} :: Chunk {i+1} ({chunk.context_label})"
                                 all_chunk_labels_list.append(label)
                                 chunk_label_to_object_lookup[label] = chunk

            # Store matrix, labels, and lookup in session state
            if all_chunk_embeddings_list:
                try:
                    st.session_state['all_chunk_embeddings_matrix'] = np.array(all_chunk_embeddings_list)
                    st.session_state['all_chunk_labels'] = all_chunk_labels_list
                    st.session_state['chunk_label_lookup_dict'] = chunk_label_to_object_lookup
                    st.sidebar.success(f"Stored matrix & lookup for {len(all_chunk_labels_list)} chunks.")
                except Exception as matrix_error:
                     st.sidebar.error(f"Error creating chunk embedding matrix or lookup: {matrix_error}")
                     st.session_state.pop('all_chunk_embeddings_matrix', None)
                     st.session_state.pop('all_chunk_labels', None)
                     st.session_state.pop('chunk_label_lookup_dict', None)
                     error_occurred = True
            else:
                st.session_state.pop('all_chunk_embeddings_matrix', None)
                st.session_state.pop('all_chunk_labels', None)
                st.session_state.pop('chunk_label_lookup_dict', None)
                st.sidebar.warning("No chunk embeddings were found to create matrix.")

            # Determine overall status
            docs_have_embeddings = any(doc.embedding is not None for doc in st.session_state.documents)
            chunks_have_embeddings = ('all_chunk_embeddings_matrix' in st.session_state and
                                      st.session_state['all_chunk_embeddings_matrix'] is not None and
                                      st.session_state['all_chunk_embeddings_matrix'].shape[0] > 0) # Check shape too
            st.session_state.embeddings_generated = docs_have_embeddings or chunks_have_embeddings

            # Clear previous plot data as embeddings changed
            st.session_state.coords_2d = None
            st.session_state.coords_3d = None
            st.session_state.scatter_fig_2d = None
            st.session_state.current_coords_2d = None
            st.session_state.current_labels = []

            st.rerun() # Ensure state is immediately available

        except Exception as e:
            st.sidebar.error(f"An unexpected error occurred during embedding generation: {e}")
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
        if items_available_for_level >= 1: # Need at least 1 for KNN query, 2 for KNN results
             can_analyze = True
    elif analysis_level == 'Chunks':
        if st.session_state.get('all_chunk_embeddings_matrix') is not None:
             items_available_for_level = st.session_state['all_chunk_embeddings_matrix'].shape[0]
             if items_available_for_level >= 1: # Need at least 1 chunk for plotting/analysis
                 embeddings_exist = True
                 can_analyze = True

# --- Visualization Section ---
st.header("Embedding Space Visualization")
if not embeddings_exist:
    if analysis_level == 'Documents':
        st.warning(f"Please generate embeddings. Document level plotting requires at least {MIN_ITEMS_FOR_PLOT} documents with embeddings.")
    else: # Chunks
        st.warning(f"Please generate embeddings for chunks.")
elif not analysis_service or not visualization_service:
    st.error("Analysis or Visualization Service not available.")
else:
    col1, col2 = st.columns(2)
    plot_title_suffix = analysis_level # "Documents" or "Chunks"

    # --- Get Embeddings/Labels for Plotting ---
    # These are the full sets based on the level, filtering happens in buttons if needed
    embeddings_to_plot = None
    labels_to_plot = []
    source_doc_titles_for_plot = None # For chunk coloring

    if analysis_level == 'Documents':
        docs_with_embeddings = [doc for doc in st.session_state.documents if doc.embedding is not None]
        if len(docs_with_embeddings) > 0:
             embeddings_to_plot = np.array([doc.embedding for doc in docs_with_embeddings])
             labels_to_plot = [doc.title for doc in docs_with_embeddings]
    elif analysis_level == 'Chunks':
        embeddings_to_plot = st.session_state.get('all_chunk_embeddings_matrix')
        labels_to_plot = st.session_state.get('all_chunk_labels', [])
        if labels_to_plot:
            source_doc_titles_for_plot = [label.split(' :: ')[0] for label in labels_to_plot]

    # --- Plotting Buttons ---
    if embeddings_to_plot is not None and embeddings_to_plot.shape[0] > 0:
        with col1:
            # Disable button if not enough docs for document level plot
            disable_2d_doc_plot = (analysis_level == 'Documents' and items_available_for_level < MIN_ITEMS_FOR_PLOT)
            if st.button("Show 2D Plot", disabled=disable_2d_doc_plot):
                st.session_state.scatter_fig_2d = None # Clear previous figure/selection
                st.session_state.current_coords_2d = None
                st.session_state.current_labels = []
                try:
                    with st.spinner(f"Reducing {analysis_level.lower()} dimensions to 2D..."):
                        coords_2d = analysis_service.reduce_dimensions(embeddings_to_plot, n_components=2)
                    if coords_2d is not None:
                        st.session_state.current_coords_2d = coords_2d
                        st.session_state.current_labels = labels_to_plot # Store labels used for this plot

                        color_arg = source_doc_titles_for_plot if analysis_level == 'Chunks' else None

                        fig_2d = visualization_service.plot_scatter_2d(
                            coords=coords_2d, labels=labels_to_plot,
                            title=f"2D UMAP Projection of {plot_title_suffix}",
                            color_data=color_arg
                        )
                        st.session_state.scatter_fig_2d = fig_2d
                    else:
                        st.error("Failed to generate 2D coordinates.")
                except Exception as e:
                    st.error(f"Error generating 2D plot: {e}")

        with col2:
            disable_3d_doc_plot = (analysis_level == 'Documents' and items_available_for_level < MIN_ITEMS_FOR_PLOT)
            if st.button("Show 3D Plot", disabled=disable_3d_doc_plot):
                st.session_state.scatter_fig_2d = None # Clear 2D plot state
                st.session_state.current_coords_2d = None
                st.session_state.current_labels = []
                try:
                    with st.spinner(f"Reducing {analysis_level.lower()} dimensions to 3D..."):
                        coords_3d = analysis_service.reduce_dimensions(embeddings_to_plot, n_components=3)
                    if coords_3d is not None:
                        color_arg = source_doc_titles_for_plot if analysis_level == 'Chunks' else None
                        fig_3d = visualization_service.plot_scatter_3d(
                            coords=coords_3d, labels=labels_to_plot,
                            title=f"3D UMAP Projection of {plot_title_suffix}"
                            # Pass color_arg if plot_scatter_3d supports it
                        )
                        st.plotly_chart(fig_3d, use_container_width=True)
                    else:
                        st.error("Failed to generate 3D coordinates.")
                except Exception as e:
                    st.error(f"Error generating 3D plot: {e}")
    else:
        st.info("No embeddings available to generate plots for the selected level.")

    # --- Display 2D Plot and Handle Selection (Semantic Center) ---
    if st.session_state.get('scatter_fig_2d') is not None:
         event_data = st.plotly_chart(
             st.session_state.scatter_fig_2d,
             use_container_width=True,
             on_select="rerun",
             key="umap_scatter_2d"
         )

         selection = None
         if event_data and event_data.get("selection") and event_data["selection"].get("point_indices"):
             selected_indices = event_data["selection"]["point_indices"]
             if selected_indices:
                 selection = {'indices': selected_indices}
                 print(f"DEBUG: Plot selection detected: Indices {selected_indices}")

         if selection and len(selection['indices']) == 3:
             st.subheader("Triangle Analysis (Plot Selection)")
             selected_indices_from_plot = selection['indices']

             # Use labels stored when the plot was created
             current_plot_labels = st.session_state.get('current_labels', [])

             if current_plot_labels and all(idx < len(current_plot_labels) for idx in selected_indices_from_plot):
                 selected_labels_display = [current_plot_labels[i] for i in selected_indices_from_plot]
                 st.write("**Selected Vertices:**")
                 for i, label in enumerate(selected_labels_display):
                     st.write(f"- {label} (Plot Index: {selected_indices_from_plot[i]})")

                 try:
                     # --- Get High-Dim Data for Analysis ---
                     selected_high_dim_embeddings = None # Initialize to handle potential assignment failure
                     high_dim_corpus_matrix = None
                     high_dim_corpus_labels = []
                     lookup_dict = {}

                     if analysis_level == 'Documents':
                         # Need to find the original documents corresponding to the plot labels
                         docs_map = {doc.title: doc for doc in st.session_state.documents if doc.embedding is not None}
                         selected_docs = [docs_map.get(lbl) for lbl in selected_labels_display]
                         if None in selected_docs:
                              st.error("Could not map plot labels back to document objects.")
                         else:
                              selected_high_dim_embeddings = [doc.embedding for doc in selected_docs]
                              # Corpus is all docs with embeddings
                              all_docs_with_embeddings = list(docs_map.values())
                              high_dim_corpus_matrix = np.array([doc.embedding for doc in all_docs_with_embeddings])
                              high_dim_corpus_labels = [doc.title for doc in all_docs_with_embeddings]

                     elif analysis_level == 'Chunks':
                         high_dim_corpus_matrix = st.session_state.get('all_chunk_embeddings_matrix')
                         high_dim_corpus_labels = st.session_state.get('all_chunk_labels', [])
                         lookup_dict = st.session_state.get('chunk_label_lookup_dict', {})
                         # Map plot indices to high-dim matrix indices - assumes plot used all_chunk_labels directly
                         # If the plot was potentially filtered, this mapping needs adjustment
                         if high_dim_corpus_matrix is not None and all(idx < high_dim_corpus_matrix.shape[0] for idx in selected_indices_from_plot):
                              selected_high_dim_embeddings = high_dim_corpus_matrix[selected_indices_from_plot]
                         else:
                              st.error("Mismatch between plot indices and chunk embedding matrix.")
                              selected_high_dim_embeddings = None # Prevent further processing

                     # --- Proceed if embeddings found ---
                     if selected_high_dim_embeddings is not None and high_dim_corpus_matrix is not None and high_dim_corpus_labels:
                          # Calculate mean embedding
                          mean_high_dim_emb = np.mean(np.array(selected_high_dim_embeddings), axis=0)

                          # Find Nearest Neighbor in the high-dim corpus
                          nn_indices, nn_scores = analysis_service.find_k_nearest(
                              mean_high_dim_emb, high_dim_corpus_matrix, k=1
                          )

                          if nn_indices is not None and len(nn_indices) > 0:
                              nearest_neighbor_index = nn_indices[0]
                              nearest_neighbor_label = high_dim_corpus_labels[nearest_neighbor_index]
                              nearest_neighbor_score = nn_scores[0]
                              st.write(f"**Semantic Center:** Closest item is **{nearest_neighbor_label}**")
                              st.write(f"(Similarity Score: {nearest_neighbor_score:.4f})")
                          else:
                              # Corrected indentation for the else block
                              st.warning("Could not determine the nearest item to the semantic center.")
                     else:
                          st.warning("Could not retrieve necessary embeddings for semantic center analysis.")

                 except Exception as e:
                     st.error(f"Error during semantic center analysis: {e}")
             else:
                 st.warning("Selection indices out of bounds or plot labels mismatch.")
         elif selection:
             st.info(f"Select exactly 3 points for triangle analysis (selected {len(selection['indices'])}).")


# --- Document/Chunk Structure Table & Multiselect Analysis ---
with st.expander("View Document/Chunk Structure & Select Chunks for Analysis"):
    if not st.session_state.documents:
        st.write("No documents loaded.")
    else:
        # --- Build Table Data --- (Logic to build table_data remains the same)
        table_data = []
        max_chunks = 0
        docs_have_chunks_attr = any(hasattr(doc, 'chunks') for doc in st.session_state.documents)

        if docs_have_chunks_attr:
            for doc in st.session_state.documents:
               if hasattr(doc, 'chunks') and doc.chunks:
                    max_chunks = max(max_chunks, len(doc.chunks))

        if not docs_have_chunks_attr:
           st.info("Run 'Chunk Loaded Documents' first.")
        elif max_chunks == 0:
           st.info("Chunking resulted in 0 chunks.")
        else:
            # Build the actual table data rows
            for doc in st.session_state.documents:
                row_data = {'Document': doc.title}
                if hasattr(doc, 'chunks') and doc.chunks:
                    for i in range(max_chunks):
                        col_name = f"Chunk {i+1}"
                        row_data[col_name] = doc.chunks[i].context_label if i < len(doc.chunks) else ""
                else:
                   for i in range(max_chunks): row_data[f"Chunk {i+1}"] = "-"
                table_data.append(row_data)

            # --- Display Table and then Multiselect --- (If table_data was built)
            if table_data:
                # --- Step 1: Display Table --- (Separate Try/Except)
                try:
                    df = pd.DataFrame(table_data).set_index('Document')
                    st.write("Chunk Overview (Context Labels shown):")
                    st.dataframe(df)
                except Exception as e:
                     st.error(f"Error creating structure table: {e}")

                # --- Step 2: Display Multiselect Logic (AFTER table display attempt) ---
                # This block is now outside the table try/except, but still inside `if table_data:`
                chunk_selection_options = st.session_state.get('all_chunk_labels', [])
                lookup = st.session_state.get('chunk_label_lookup_dict', {})

                if chunk_selection_options:
                    st.markdown("---")
                    st.subheader("Select 3 Chunks for Table-Based Analysis:")
                    selected_chunk_labels = st.multiselect(
                        label="Select exactly 3 chunks from the list below:",
                        options=chunk_selection_options, key="chunk_multiselect"
                    )

                    if st.button("Analyze Table Selection", key="analyze_table_button"):
                        if len(selected_chunk_labels) == 3:
                            st.write("**Analyzing Selection from Table:**")
                            for label in selected_chunk_labels: st.write(f"- {label}")
                            try:
                                selected_chunks = [lookup.get(label) for label in selected_chunk_labels]
                                if None in selected_chunks:
                                   st.error("Could not find data for one or more selected chunk labels.")
                                else:
                                    selected_embeddings = [chunk.embedding for chunk in selected_chunks]
                                    if all(emb is not None for emb in selected_embeddings):
                                        mean_high_dim_emb = np.mean(np.array(selected_embeddings), axis=0)
                                        corpus_embeddings_array = st.session_state.get('all_chunk_embeddings_matrix')
                                        corpus_labels = st.session_state.get('all_chunk_labels', [])

                                        if corpus_embeddings_array is None or not corpus_labels:
                                           st.error("Chunk corpus unavailable for KNN search.")
                                        elif corpus_embeddings_array.ndim == 2 and corpus_embeddings_array.shape[0] > 0:
                                           indices, scores = analysis_service.find_k_nearest(mean_high_dim_emb, corpus_embeddings_array, k=1)
                                           if indices is not None and len(indices) > 0:
                                               nearest_neighbor_index = indices[0]
                                               nearest_neighbor_label = corpus_labels[nearest_neighbor_index]
                                               nearest_neighbor_score = scores[0]
                                               st.write(f"**Semantic Center:** Closest item is **{nearest_neighbor_label}**")
                                               st.write(f"(Similarity Score: {nearest_neighbor_score:.4f})")
                                           else:
                                               st.warning("Could not determine the nearest item to the semantic center.")
                                        else:
                                           st.error("Invalid corpus created for KNN search.")
                                    else:
                                       st.error("One or more selected chunks lack embeddings.")
                            except Exception as e:
                                st.error(f"An error occurred during table selection analysis: {e}")
                        else:
                            st.error(f"Please select exactly 3 chunks (you selected {len(selected_chunk_labels)}).")
                else:
                    st.info("No chunks with embeddings available for table analysis selection.")

            # --- Else for `if table_data:` (Correctly aligned) ---
            else:
                # This executes if the table_data list ended up empty after the build logic
                st.write("No table data generated (table_data list was empty).")


# --- Manual Simplex Analysis Section ---
st.header("Manual Simplex Analysis")
item_options = []
item_map = {}
current_level = st.session_state.get('analysis_level', 'Documents')

if current_level == 'Documents':
    # Filter docs with embeddings
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
                    if item and hasattr(item, 'embedding') and item.embedding is not None: # Check attribute exists
                        selected_embeddings.append(item.embedding)
                    else:
                        st.error(f"Could not find item or embedding for: '{label}'")
                        valid_embeddings = False; break

                if valid_embeddings:
                    mean_high_dim_emb = np.mean(np.array(selected_embeddings), axis=0)
                    corpus_embeddings_array = None
                    corpus_labels = []

                    if current_level == 'Documents':
                         # Rebuild from item_map which already contains only items with embeddings
                         corpus_items = list(item_map.values())
                         corpus_embeddings_array = np.array([item.embedding for item in corpus_items])
                         corpus_labels = list(item_map.keys())
                    elif current_level == 'Chunks':
                         corpus_embeddings_array = st.session_state.get('all_chunk_embeddings_matrix')
                         corpus_labels = st.session_state.get('all_chunk_labels', [])

                    if corpus_embeddings_array is None or not corpus_labels:
                        st.error("Corpus for KNN search unavailable.")
                    elif corpus_embeddings_array.ndim == 2 and corpus_embeddings_array.shape[0] > 0:
                         indices, scores = analysis_service.find_k_nearest(mean_high_dim_emb, corpus_embeddings_array, k=1)
                         if indices is not None and len(indices) > 0:
                              nearest_neighbor_index = indices[0]
                              nearest_neighbor_label = corpus_labels[nearest_neighbor_index]
                              nearest_neighbor_score = scores[0]
                              st.write("**Manual Selection Analysis Results:**")
                              st.write(f"- Vertex 1: {item1_label}\n- Vertex 2: {item2_label}\n- Vertex 3: {item3_label}")
                              st.write(f"**Semantic Center:** Closest item is **{nearest_neighbor_label}**")
                              st.write(f"(Similarity Score: {nearest_neighbor_score:.4f})")
                         else:
                              # Corrected indentation for the else block
                              st.warning("Could not determine the nearest item to the semantic center.")
                    else:
                         st.error("Invalid corpus for KNN search.")
            except Exception as e:
                 st.error(f"An error occurred during manual analysis: {e}")


# --- Nearest Neighbors Analysis Section ---
st.header("Nearest Neighbors Analysis")
if not can_analyze: # Use the flag determined earlier
    st.warning(f"Generate embeddings for at least 1 {analysis_level.lower()} first to perform nearest neighbor analysis.")
elif not analysis_service:
     st.error("Analysis Service not available.")
else:
    query_options = {}
    num_items = 0

    if analysis_level == 'Documents':
        items_with_embeddings = [doc for doc in st.session_state.documents if doc.embedding is not None]
        num_items = len(items_with_embeddings)
        query_options = {doc.title: doc.title for doc in items_with_embeddings} # Map title to title for simplicity
    elif analysis_level == 'Chunks':
        chunk_labels = st.session_state.get('all_chunk_labels', [])
        num_items = len(chunk_labels)
        query_options = {label: label for label in chunk_labels} # Map label to label

    if not query_options:
        st.info(f"No {analysis_level.lower()} with embeddings available for KNN analysis.")
    else:
        selected_key = st.selectbox(f"Select Query {analysis_level[:-1]}:", options=query_options.keys())
        max_k = max(0, num_items - 1)

        if max_k < 1:
             st.warning(f"Need at least 2 {analysis_level.lower()} with embeddings for KNN.")
        else:
            k_neighbors = st.number_input("Number of neighbors (k):", min_value=1, max_value=max_k, value=min(DEFAULT_K, max_k), step=1)

            if st.button("Find Nearest Neighbors"):
                query_emb = None
                query_id = selected_key # Use label/title as ID for simplicity

                try:
                    if analysis_level == 'Documents':
                        # Find the document object from the selected title
                        doc_map = {doc.title: doc for doc in st.session_state.documents if doc.embedding is not None}
                        query_item_obj = doc_map.get(selected_key)
                        if query_item_obj: query_emb = query_item_obj.embedding
                    elif analysis_level == 'Chunks':
                         # Use the lookup dictionary
                         lookup = st.session_state.get('chunk_label_lookup_dict', {})
                         query_item_obj = lookup.get(selected_key)
                         if query_item_obj: query_emb = query_item_obj.embedding

                    if query_emb is not None:
                        # Get corpus based on level
                        corpus_embeddings = None
                        corpus_labels = []
                        if analysis_level == 'Documents':
                            docs_with_embed = [doc for doc in st.session_state.documents if doc.embedding is not None]
                            if docs_with_embed:
                                corpus_embeddings = np.array([d.embedding for d in docs_with_embed])
                                corpus_labels = [d.title for d in docs_with_embed]
                        elif analysis_level == 'Chunks':
                            corpus_embeddings = st.session_state.get('all_chunk_embeddings_matrix')
                            corpus_labels = st.session_state.get('all_chunk_labels', [])

                        if corpus_embeddings is None or corpus_embeddings.ndim != 2 or corpus_embeddings.shape[0] < 1:
                            st.error(f"Invalid or empty corpus embeddings data for {analysis_level}.")
                        else:
                            indices, scores = analysis_service.find_k_nearest(query_emb, corpus_embeddings, k=k_neighbors) # Service handles self-exclusion

                            st.subheader(f"Top {k_neighbors} neighbors for: {selected_key}")
                            results = []
                            if indices is not None:
                                for idx, score in zip(indices, scores):
                                    if 0 <= idx < len(corpus_labels):
                                        neighbor_label = corpus_labels[idx]
                                        # Simple check to exclude self using label/title if find_k_nearest didn't
                                        if neighbor_label != query_id:
                                             results.append({"Neighbor": neighbor_label, "Similarity Score": f"{score:.4f}"})
                            if results:
                                st.table(results)
                            else:
                                # Corrected indentation for the else block
                                st.write("No distinct neighbors found.")

                    # Moved the 'else' for missing query embedding to the correct scope
                    else:
                        st.error(f"Embedding not found for selected query {analysis_level[:-1]} ('{selected_key}').")

                except Exception as e:
                    st.error(f"Error finding nearest neighbors: {e}")


# --- Display loaded documents details ---
with st.expander("View Loaded Documents", expanded=False): # Set expanded=False by default
    if st.session_state.documents:
        for i, doc in enumerate(st.session_state.documents):
            embed_status = "Yes" if doc.embedding is not None else "No"
            st.markdown(f"**{i+1}. {doc.title}** - Doc Embedding: {embed_status}")
            # st.caption(doc.content[:100] + "...") # Can be verbose

            if hasattr(doc, 'chunks') and doc.chunks:
                chunk_embed_counts = sum(1 for chunk in doc.chunks if chunk.embedding is not None)
                st.markdown(f"    Chunks: {len(doc.chunks)} ({chunk_embed_counts} embedded)")
                # Optionally show first few chunk details
                # with st.container():
                #     for chunk_idx, chunk in enumerate(doc.chunks[:3]):
                #         chunk_embed_status = "Yes" if chunk.embedding is not None else "No"
                #         st.markdown(f"      - Chk {chunk_idx+1}: **{chunk.context_label}** (Embed: {chunk_embed_status})")
                #     if len(doc.chunks) > 3: st.markdown("      - ...")
            elif hasattr(doc, 'chunks'):
                 st.markdown("    Chunks: 0")
            else:
                 st.markdown("    Chunks: Not Processed")
            st.divider()
    else:
        st.write("No documents loaded.")

# --- (Optional) Computational Matrices Info Expander ---
with st.expander("View Computational Matrices Info", expanded=False):
    if 'all_chunk_embeddings_matrix' in st.session_state and st.session_state['all_chunk_embeddings_matrix'] is not None:
        st.write(f"**Chunk Embedding Matrix:**")
        st.write(f"- Shape: {st.session_state['all_chunk_embeddings_matrix'].shape}")
        st.write(f"- Number of Chunks: {len(st.session_state.get('all_chunk_labels', []))}")

        if st.button("Compute & Show Similarity Matrix Info"):
            if analysis_service:
                sim_matrix = analysis_service.calculate_similarity_matrix(st.session_state['all_chunk_embeddings_matrix'])
                if sim_matrix is not None:
                    st.write(f"**Chunk Similarity Matrix:**")
                    st.write(f"- Shape: {sim_matrix.shape}")
                    if sim_matrix.shape[0] < 25:
                         try:
                              import plotly.express as px
                              fig = px.imshow(sim_matrix, text_auto=".2f", aspect="auto",
                                                labels=dict(x="Chunk Index", y="Chunk Index", color="Similarity"),
                                                x=st.session_state.get('all_chunk_labels', []),
                                                y=st.session_state.get('all_chunk_labels', []),
                                                title="Chunk Similarity Matrix Heatmap")
                              fig.update_xaxes(side="top", tickangle=45) # Improve label readability
                              st.plotly_chart(fig)
                         except ImportError:
                              st.warning("Plotly Express not found for heatmap. Please install.")
                         except Exception as e:
                              st.error(f"Failed to generate similarity heatmap: {e}")
                    else:
                         st.info(f"Similarity matrix ({sim_matrix.shape[0]}x{sim_matrix.shape[0]}) too large for heatmap display.")
                else:
                    st.error("Failed to compute similarity matrix.")
            else:
                st.error("Analysis Service not available.")
    else:
        st.info("Chunk embedding matrix not yet generated. Please generate embeddings.")