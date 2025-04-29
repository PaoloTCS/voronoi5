import streamlit as st
import numpy as np
import os
import io # Added io
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
SAMPLE_DOCS = [
    Document(title="Doc 1: AI Intro", content="Artificial intelligence is transforming industries."),
    Document(title="Doc 2: ML Basics", content="Machine learning uses algorithms to find patterns in data."),
    Document(title="Doc 3: NLP Explained", content="Natural Language Processing enables computers to understand text."),
    Document(title="Doc 4: Computer Vision", content="Computer vision allows machines to interpret images."),
    Document(title="Doc 5: AI Ethics", content="Ethical considerations are crucial in AI development.")
]
DEFAULT_K = 3

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
        # Don't try to load if dependencies are missing
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
        'coords_2d': None,
        'coords_3d': None,
        'doc_labels': [],
        'all_embeddings_array': None, # Store the numpy array of all embeddings
        'analysis_level': 'Documents' # Default level
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

initialize_session_state()

# --- Helper Functions ---
def get_all_embeddings() -> Optional[np.ndarray]:
    """Collects embeddings from session state documents into a NumPy array."""
    docs_with_embeddings = [doc for doc in st.session_state.documents if doc.embedding is not None]
    if not docs_with_embeddings or len(docs_with_embeddings) != len(st.session_state.documents):
        # Ensure all documents have embeddings before creating the array
        st.warning("Not all documents have embeddings. Please generate embeddings first.")
        return None
    try:
        return np.array([doc.embedding for doc in docs_with_embeddings])
    except ValueError as e:
        st.error(f"Error stacking embeddings: {e}. Ensure all embeddings have the same dimension.")
        return None

def reset_derived_data(clear_docs=False):
    """Clears embeddings, chunks, derived data. Optionally clears documents too."""
    if clear_docs:
        st.session_state.documents = []
        st.session_state.doc_labels = []
    else:
        # Clear embeddings and chunks from existing docs
        for doc in st.session_state.documents:
            doc.embedding = None
            # Also clear chunks when resetting derived data but keeping docs
            if hasattr(doc, 'chunks'): 
                doc.chunks = [] 
        st.session_state.doc_labels = [doc.title for doc in st.session_state.documents] # Rebuild labels if docs kept

    # Reset flags and derived data regardless
    st.session_state.embeddings_generated = False
    st.session_state.coords_2d = None
    st.session_state.coords_3d = None
    st.session_state.all_embeddings_array = None 
    st.session_state.analysis_level = 'Documents' # Reset analysis level
    # Add any other chunk-specific state reset here if needed


# --- Streamlit App UI ---
st.title("Voronoi5 - Document Analysis Tool")

# Sidebar for Loading and Options
st.sidebar.header("Document Loading")

# --- Remove Sample Button ---
# if st.sidebar.button("Load Sample Documents"):
#     reset_derived_data(clear_docs=True) # Reset state before loading new docs
#     st.session_state.documents = SAMPLE_DOCS[:] # Use a copy
#     st.session_state.doc_labels = [doc.title for doc in st.session_state.documents]
#     st.sidebar.success(f"Loaded {len(st.session_state.documents)} sample documents.")
#     st.rerun() # Rerun to update UI reflecting loaded docs

# --- Add File Uploader ---
uploaded_files = st.sidebar.file_uploader(
    "Upload Documents (TXT or PDF)",
    type=['txt', 'pdf'],
    accept_multiple_files=True,
    key="file_uploader" # Add key to help Streamlit manage state
)

# --- Add Process Button ---
if st.sidebar.button("Process Uploaded Files"):
    if uploaded_files:
        new_docs_added = []
        # Don't reset derived data here automatically
        current_doc_names = {doc.title for doc in st.session_state.documents} # Check against current state
        
        # Flag to indicate if derived data should be reset after successful uploads
        should_reset_derived = False 

        for uploaded_file in uploaded_files:
            if uploaded_file.name in current_doc_names:
                st.sidebar.warning(f"Skipping '{uploaded_file.name}': A document with this name already exists.")
                continue
            
            text = ""
            try:
                if uploaded_file.type == 'application/pdf':
                    reader = PdfReader(uploaded_file)
                    text = "".join(page.extract_text() for page in reader.pages if page.extract_text())
                    if not text:
                         st.sidebar.error(f"Could not extract text from PDF '{uploaded_file.name}'.")
                         continue
                elif uploaded_file.type == 'text/plain':
                    text = uploaded_file.getvalue().decode("utf-8")
                else:
                    st.sidebar.error(f"Unsupported file type: {uploaded_file.type} for '{uploaded_file.name}'")
                    continue

                new_doc = Document(
                    title=uploaded_file.name,
                    content=text,
                    metadata={'source': 'upload', 'type': uploaded_file.type, 'size': uploaded_file.size}
                )
                new_docs_added.append(new_doc)
                current_doc_names.add(uploaded_file.name) # Add to set to prevent duplicate additions in same batch
                st.sidebar.success(f"Processed '{uploaded_file.name}'")
                should_reset_derived = True # Mark that we need to reset embeddings etc.

            except Exception as e:
                st.sidebar.error(f"Error processing file '{uploaded_file.name}': {e}")

        if new_docs_added:
            # If new documents were successfully added, reset embeddings/plots
            if should_reset_derived:
                 print("New documents added, resetting derived data (embeddings, plots).")
                 reset_derived_data(clear_docs=False) # Clear embeddings/plots but keep docs
            
            # Append new documents to the existing list
            st.session_state.documents = st.session_state.documents + new_docs_added
            # Update labels to include new docs
            st.session_state.doc_labels = [doc.title for doc in st.session_state.documents] 
            st.sidebar.info(f"Added {len(new_docs_added)} new documents.")
            st.rerun() # Rerun to reflect the new document list
    else:
        st.sidebar.warning("No files selected in the uploader to process.")

# --- Add Clear Button ---
if st.sidebar.button("Clear All Documents"):
    # Clear the uploader widget state FIRST
    # st.session_state.file_uploader = None 
    # Then reset the rest of the state
    reset_derived_data(clear_docs=True)
    st.sidebar.info("All loaded documents and data cleared.")
    st.rerun()

st.sidebar.caption("Note: Clearing documents here does not clear the file uploader selection. Use the 'x' in the uploader UI to remove selected files.")

if not st.session_state.documents:
    st.info("Upload documents and click 'Process Uploaded Files' to begin.")
    st.stop() # Stop execution if no documents are loaded

st.sidebar.header("Processing")
if st.sidebar.button("Generate Embeddings", disabled=not embedding_service):
    if embedding_service and st.session_state.documents:
        try:
            with st.spinner("Generating embeddings for documents and chunks..."):
                docs_processed_count = 0
                chunks_processed_count = 0
                total_chunks_count = 0
                updated_documents = [] # To hold modified documents
                error_occurred = False

                for i, doc in enumerate(st.session_state.documents):
                    doc_updated = False
                    # 1. Process Document Embedding
                    if doc.embedding is None:
                        try:
                            doc.embedding = embedding_service.generate_embedding(doc.content)
                            docs_processed_count += 1
                            doc_updated = True
                        except Exception as e:
                            st.sidebar.error(f"Error embedding doc '{doc.title}': {e}")
                            error_occurred = True

                    # 2. Process Chunk Embeddings (if chunks exist)
                    if hasattr(doc, 'chunks') and doc.chunks:
                        total_chunks_count += len(doc.chunks)
                        for j, chunk in enumerate(doc.chunks):
                            if chunk.embedding is None:
                                try:
                                    chunk.embedding = embedding_service.generate_embedding(chunk.content)
                                    # Note: We need to make sure this modification persists.
                                    # If doc.chunks is just a copy, this won't work directly.
                                    # Best practice is often to rebuild the list/object structure.
                                    # Here we assume modifying the chunk object in the list works.
                                    chunks_processed_count += 1
                                    doc_updated = True # Mark doc as updated if any chunk was processed
                                except Exception as e:
                                    st.sidebar.error(f"Error embedding chunk {j+1} in doc '{doc.title}': {e}")
                                    error_occurred = True
                    
                    updated_documents.append(doc) # Add the (potentially modified) doc to the new list
                
                # Update session state with the modified documents
                st.session_state.documents = updated_documents

            # --- Post-processing (Needs update in Step 7) ---
            # Current logic assumes only doc embeddings exist. This needs changing later.
            # For now, we'll set a simple flag. The actual array generation needs fixing.
            if not error_occurred:
                st.session_state.embeddings_generated = True # Mark that *some* embeddings exist
                st.sidebar.success(f"Embeddings generated/updated for {docs_processed_count} docs and {chunks_processed_count} chunks (out of {total_chunks_count} total).")
                st.session_state.coords_2d = None # Reset plots
                st.session_state.coords_3d = None
                st.session_state.all_embeddings_array = None # This needs specific handling later
                st.rerun()
            else:
                 st.sidebar.warning("Embedding generation finished with errors.")
                 st.session_state.embeddings_generated = True # Still potentially usable
                 st.rerun()

        except Exception as e:
            st.sidebar.error(f"An unexpected error occurred during embedding generation: {e}")
    elif not embedding_service:
        st.sidebar.error("Embedding Service not available.")
    else:
        st.sidebar.warning("No documents loaded to generate embeddings for.")

# Add Chunking button and logic
if st.sidebar.button("Chunk Loaded Documents", disabled=not chunker):
    if chunker and st.session_state.documents:
        updated_documents = []
        error_occurred = False
        try:
            with st.spinner("Chunking documents..."):
                for doc in st.session_state.documents:
                    try:
                        # Ensure the document object can store chunks
                        if not hasattr(doc, 'chunks'):
                            doc.chunks = [] # Initialize if missing
                        
                        doc.chunks = chunker.chunk_document(doc)
                        updated_documents.append(doc) # Append the updated doc
                    except Exception as e:
                         st.sidebar.error(f"Error chunking doc '{doc.title}': {e}")
                         updated_documents.append(doc) # Append original doc on error
                         error_occurred = True
            
            # Update the session state list
            st.session_state.documents = updated_documents
            
            if not error_occurred:
                st.sidebar.success(f"Chunking complete for {len(st.session_state.documents)} documents.")
            else:
                st.sidebar.warning("Chunking completed with some errors.")
            
            # Optionally add a flag
            # st.session_state.documents_chunked = True 
            st.rerun() # Rerun to update UI potentially

        except Exception as e:
            st.sidebar.error(f"An unexpected error occurred during chunking: {e}")
    elif not chunker:
         st.sidebar.error("Chunking Service not available.")
    else:
        st.sidebar.warning("No documents loaded to chunk.")

# --- Main Area Logic ---
st.header("Analysis Configuration")
analysis_level = st.radio(
    "Analyze/Visualize Level:",
    ('Documents', 'Chunks'),
    key='analysis_level', # Use the key defined in session state
    horizontal=True
)

# Main Area for Visualization and Analysis
st.header("Embedding Space Visualization")

# Initialize state variables for plot data if they don't exist
if 'scatter_fig_2d' not in st.session_state:
    st.session_state.scatter_fig_2d = None
if 'current_coords_2d' not in st.session_state:
    st.session_state.current_coords_2d = None
if 'current_labels' not in st.session_state:
    st.session_state.current_labels = []

# Check if embeddings exist at the required level
embeddings_exist = False
if st.session_state.embeddings_generated: # Basic check if *any* embeddings were generated
    if analysis_level == 'Documents':
        # Check if all docs have embeddings
        if all(doc.embedding is not None for doc in st.session_state.documents):
            embeddings_exist = True
    elif analysis_level == 'Chunks':
        # Check if at least one chunk has an embedding
        if any(hasattr(doc, 'chunks') and chunk.embedding is not None for doc in st.session_state.documents for chunk in doc.chunks):
            embeddings_exist = True

if not embeddings_exist:
    st.warning(f"Please generate embeddings for {analysis_level.lower()} using the sidebar button first.")
else:
    if analysis_service and visualization_service:
        col1, col2 = st.columns(2)

        # --- Prepare data based on selected level ---
        embeddings_to_plot = []
        labels_to_plot = []
        plot_title_suffix = ""

        if analysis_level == 'Documents':
            embeddings_to_plot = np.array([doc.embedding for doc in st.session_state.documents if doc.embedding is not None])
            labels_to_plot = [doc.title for doc in st.session_state.documents if doc.embedding is not None]
            plot_title_suffix = "Documents"
        elif analysis_level == 'Chunks':
            temp_embeddings = []
            temp_labels = []
            for doc in st.session_state.documents:
                if hasattr(doc, 'chunks') and doc.chunks:
                    for i, chunk in enumerate(doc.chunks):
                        if chunk.embedding is not None:
                            temp_embeddings.append(chunk.embedding)
                            temp_labels.append(f"{doc.title[:15]}... - Chk {i+1} ({chunk.context_label[:10]}...)")
            if temp_embeddings:
                embeddings_to_plot = np.array(temp_embeddings)
                labels_to_plot = temp_labels
                plot_title_suffix = "Chunks"
            else:
                 st.warning("No chunks with embeddings found. Chunk documents and generate embeddings.")
                 # Keep embeddings_to_plot empty to prevent plotting

        # --- Plotting Buttons ---
        if embeddings_to_plot.size > 0: # Only show buttons if we have data
            with col1:
                if st.button("Show 2D Plot"):
                    st.session_state.scatter_fig_2d = None # Clear previous figure/selection
                    st.session_state.current_coords_2d = None
                    st.session_state.current_labels = []
                    try:
                        # --- DEBUG --- 
                        print(f"DEBUG [app.py]: Analysis Level: {analysis_level}")
                        print(f"DEBUG [app.py]: Shape of embeddings passed to reduce_dimensions: {embeddings_to_plot.shape}")
                        # --- END DEBUG ---
                        with st.spinner(f"Reducing {analysis_level.lower()} dimensions to 2D..."):
                            coords_2d = analysis_service.reduce_dimensions(embeddings_to_plot, n_components=2)
                        if coords_2d is not None:
                            # Store data used for the plot
                            st.session_state.current_coords_2d = coords_2d
                            st.session_state.current_labels = labels_to_plot
                            
                            fig_2d = visualization_service.plot_scatter_2d(
                                coords=coords_2d,
                                labels=labels_to_plot,
                                title=f"2D UMAP Projection of {plot_title_suffix}"
                            )
                            # Store the figure itself
                            st.session_state.scatter_fig_2d = fig_2d
                            # Display is handled below, outside the button block
                        else:
                            st.error("Failed to generate 2D coordinates.")
                            st.session_state.scatter_fig_2d = None # Ensure cleared on failure
                    except Exception as e:
                        st.error(f"Error generating 2D plot: {e}")
                        st.session_state.scatter_fig_2d = None # Ensure cleared on failure

            with col2:
                if st.button("Show 3D Plot"):
                    # (Keep 3D plot logic as is, maybe clear 2D selection state)
                    st.session_state.scatter_fig_2d = None 
                    st.session_state.current_coords_2d = None
                    st.session_state.current_labels = []
                    try:
                        with st.spinner(f"Reducing {analysis_level.lower()} dimensions to 3D..."):
                            coords_3d = analysis_service.reduce_dimensions(embeddings_to_plot, n_components=3)
                        if coords_3d is not None:
                            fig_3d = visualization_service.plot_scatter_3d(
                                coords=coords_3d,
                                labels=labels_to_plot,
                                title=f"3D UMAP Projection of {plot_title_suffix}"
                            )
                            st.plotly_chart(fig_3d, use_container_width=True)
                        else:
                            st.error("Failed to generate 3D coordinates.")
                    except Exception as e:
                        st.error(f"Error generating 3D plot: {e}")
        
        # --- Display 2D Plot and Handle Selection ---
        if st.session_state.scatter_fig_2d:
             # Use a unique key for the chart to help with event state
             chart_key = "scatter_2d_selectable"
             # Display the chart, enabling selection events
             event_data = st.plotly_chart(
                 st.session_state.scatter_fig_2d, 
                 use_container_width=True, 
                 on_select="rerun",
                 key=chart_key
             ) 
             
             # --- REMOVE DEBUG: Show raw event data ---
             # if event_data:
             #    st.write("DEBUG: Raw Plot Event Data:", event_data)
             # --- END DEBUG ---
             
             # Check for selection event data using the chart key
             selection = None
             # Corrected key access based on debug data
             if event_data and event_data.get("selection") and event_data["selection"].get("point_indices"):
                  selected_indices = event_data["selection"]["point_indices"] # Use direct list
                  if selected_indices:
                      selection = {'indices': selected_indices}
                      print(f"DEBUG: Plot selection detected: Indices {selected_indices}") # Keep this debug log
             
             # Perform analysis if exactly 3 points are selected
             if selection and len(selection['indices']) == 3:
                 st.subheader("Triangle Analysis")
                 selected_indices = selection['indices']
                 
                 # Ensure we have the coordinates and labels corresponding to the current plot
                 if st.session_state.current_coords_2d is not None and st.session_state.current_labels:
                     current_coords = st.session_state.current_coords_2d
                     current_labels = st.session_state.current_labels
                     
                     # Check if indices are valid for the current data
                     if all(idx < len(current_labels) for idx in selected_indices):
                         selected_coords = current_coords[selected_indices]
                         selected_labels = [current_labels[i] for i in selected_indices]
                         
                         st.write("**Selected Vertices:**")
                         for i, label in enumerate(selected_labels):
                             st.write(f"- {label} (Point Index: {selected_indices[i]})")
                         
                         # Calculate centroid
                         centroid = analysis_service.calculate_centroid(selected_coords)
                         
                         if centroid is not None:
                             st.write(f"**Calculated Centroid Coordinates:** `{centroid}`")
                             # Optional: Find nearest neighbors to centroid (Future enhancement)
                         else:
                             st.error("Could not calculate centroid for the selected points.")
                     else:
                         st.warning("Selection indices are out of bounds for the current plot data.")
                 else:
                     st.warning("Current plot data not found in session state for analysis.")
             elif selection:
                 st.info(f"Select exactly 3 points to perform triangle analysis (selected {len(selection['indices'])}). Clear selection by clicking empty space or double-clicking.")
    else:
        st.error("Analysis or Visualization Service not available.")


st.header("Nearest Neighbors Analysis")

# Check if embeddings exist at the required level for KNN
knn_embeddings_exist = False
min_items_for_knn = 2 # Need at least query + 1 neighbor

if st.session_state.embeddings_generated: # Basic check
    if analysis_level == 'Documents':
        # Check if enough documents have embeddings
        if sum(1 for doc in st.session_state.documents if doc.embedding is not None) >= min_items_for_knn:
            knn_embeddings_exist = True
    elif analysis_level == 'Chunks':
        # Check if enough chunks have embeddings
        chunk_embedding_count = sum(
            1 for doc in st.session_state.documents
            if hasattr(doc, 'chunks')
            for chunk in doc.chunks
            if chunk.embedding is not None
        )
        if chunk_embedding_count >= min_items_for_knn:
            knn_embeddings_exist = True

if not knn_embeddings_exist:
    st.warning(f"Generate embeddings for at least {min_items_for_knn} {analysis_level.lower()} first to perform nearest neighbor analysis.")
elif analysis_service:

    query_options = {}
    all_items_for_knn = [] # List to hold either Document or Chunk objects

    # --- Prepare KNN data based on selected level ---
    if analysis_level == 'Documents':
        # Existing logic: Use document titles and indices
        all_items_for_knn = [doc for doc in st.session_state.documents if doc.embedding is not None]
        query_options = {f"{i+1}. {doc.title}": i for i, doc in enumerate(all_items_for_knn)}
    
    elif analysis_level == 'Chunks':
        # Create options for chunks
        chunk_index_counter = 0
        for doc_idx, doc in enumerate(st.session_state.documents):
            if hasattr(doc, 'chunks') and doc.chunks:
                for chunk_idx, chunk in enumerate(doc.chunks):
                    if chunk.embedding is not None:
                        label = f"{doc.title[:15]}... - Chk {chunk_idx+1} ({chunk.context_label[:10]}...)"
                        # Store a tuple to identify the chunk: (doc_index_in_state, chunk_index_in_doc)
                        query_options[label] = (doc_idx, chunk_idx) 
                        all_items_for_knn.append(chunk) # Store the chunk object itself
                        chunk_index_counter += 1
        if chunk_index_counter < min_items_for_knn:
            st.warning("Not enough chunks with embeddings available for KNN.")
            query_options = {} # Clear options if not enough items
            all_items_for_knn = []

    # --- KNN UI Elements and Logic ---
    if query_options: # Only proceed if we have valid items
        selected_key = st.selectbox(f"Select Query {analysis_level[:-1]}:", options=query_options.keys())
        
        # Determine k max based on available items (excluding self)
        max_k = len(all_items_for_knn) - 1
        if max_k < 1:
             st.warning(f"Need at least 2 {analysis_level.lower()} with embeddings for KNN.")
        else:
            k_neighbors = st.number_input("Number of neighbors (k):", min_value=1, max_value=max_k, value=min(DEFAULT_K, max_k), step=1)

            if st.button("Find Nearest Neighbors"):
                if selected_key:
                    query_item = None
                    query_emb = None
                    query_id = None # Use for self-comparison

                    if analysis_level == 'Documents':
                        selected_index = query_options[selected_key]
                        query_item = all_items_for_knn[selected_index]
                        query_emb = query_item.embedding
                        query_id = query_item.id
                    elif analysis_level == 'Chunks':
                        doc_idx, chunk_idx = query_options[selected_key]
                        # Access the original document and then the specific chunk
                        query_item = st.session_state.documents[doc_idx].chunks[chunk_idx]
                        query_emb = query_item.embedding
                        query_id = query_item.id
                    
                    if query_emb is not None:
                        try:
                            # Prepare corpus embeddings (all items of the selected level)
                            corpus_embeddings = np.array([item.embedding for item in all_items_for_knn if item.embedding is not None])
                            
                            # Ensure corpus is valid
                            if corpus_embeddings.ndim != 2 or corpus_embeddings.shape[0] < 1:
                                st.error("Invalid corpus embeddings data.")
                            else:
                                indices, scores = analysis_service.find_k_nearest(query_emb, corpus_embeddings, k=k_neighbors + 1) # Fetch k+1 to exclude self
                                
                                st.subheader(f"Top {k_neighbors} neighbors for: {selected_key}")
                                results = []
                                count = 0
                                if indices is not None:
                                    for idx, score in zip(indices, scores):
                                        if count >= k_neighbors: break # Stop after finding k neighbors
                                        
                                        if 0 <= idx < len(all_items_for_knn):
                                            neighbor_item = all_items_for_knn[idx]
                                            neighbor_id = neighbor_item.id

                                            # Exclude the query item itself
                                            if neighbor_id != query_id:
                                                if analysis_level == 'Documents':
                                                    neighbor_label = neighbor_item.title
                                                else: # Chunks
                                                    # Reconstruct label for display (or find a better way to map)
                                                    neighbor_label = f"Chunk ID: {neighbor_id}" # Placeholder, better label needed
                                                    # Find the original label requires iterating through query_options dict - inefficient here
                                                    # For simplicity, just use the ID for now
                                                    for label, (d_idx, c_idx) in query_options.items():
                                                        if st.session_state.documents[d_idx].chunks[c_idx].id == neighbor_id:
                                                            neighbor_label = label
                                                            break
                                                    
                                                results.append({"Neighbor": neighbor_label, "Similarity Score": f"{score:.4f}"})
                                                count += 1
                                
                                if results:
                                    st.table(results)
                                else:
                                    st.write("No distinct neighbors found.")
                                    
                        except Exception as e:
                            st.error(f"Error finding nearest neighbors: {e}")
                    else:
                        st.error(f"Embedding not found for selected query {analysis_level[:-1]}.")
    else:
         st.info(f"No {analysis_level.lower()} with embeddings available for KNN analysis.")

else:
     st.error("Analysis Service not available or embeddings not generated appropriately.")

# Display loaded documents details (optional)
with st.expander("View Loaded Documents"):
    if st.session_state.documents:
        for i, doc in enumerate(st.session_state.documents):
            embed_status = "Generated" if doc.embedding is not None else "Not Generated"
            st.markdown(f"**{i+1}. {doc.title}** (ID: {doc.id}) - Embedding: {embed_status}")
            st.caption(doc.content[:100] + "...")

            # Display Chunk Info if available
            if hasattr(doc, 'chunks') and doc.chunks:
                st.markdown(f"&nbsp;&nbsp;&nbsp;&nbsp;Chunks: {len(doc.chunks)}")
                with st.container(): # Use container for better layout control
                    # Show details for the first few chunks
                    for chunk_idx, chunk in enumerate(doc.chunks[:5]): # Increased limit from 3 to 5
                        chunk_embed_status = "Generated" if chunk.embedding is not None else "Not Generated"
                        st.markdown(f"&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Chunk {chunk_idx+1}: **{chunk.context_label}** (Rank: {chunk.importance_rank}, Embed: {chunk_embed_status})")
                        st.caption(f"&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{chunk.content[:80]}...")
                    if len(doc.chunks) > 5: # Updated limit check
                         st.markdown("&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- ... (more chunks not shown)")
            elif hasattr(doc, 'chunks'): # Check if attribute exists (meaning chunking ran)
                 st.markdown("&nbsp;&nbsp;&nbsp;&nbsp;Chunks: 0") # Display 0 if list is empty
            else:
                 st.markdown("&nbsp;&nbsp;&nbsp;&nbsp;Chunks: Not Yet Processed") # If attribute doesn't exist
            st.divider()
    else:
        st.write("No documents loaded.")
