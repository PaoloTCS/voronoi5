# Voronoi6: Semantic Knowledge Explorer

**Live Demo:** [voronoi6-eupbzd4aanxptzehyeykkz.streamlit.app](https://voronoi6-eupbzd4aanxptzehyeykkz.streamlit.app)

Voronoi6 is an interactive Streamlit app for exploring the semantic structure of your documents. It uses advanced embedding, clustering, and graph techniques to reveal hidden relationships and conceptual clusters in your information.

## Key Features

- **Pairwise Similarity Matrix:**
  - Instantly view a table of all pairwise similarities between your documents or chunks.
  - Identify the most and least similar items at a glance.

- **Semantic Graph Visualization:**
  - Visualize your data as a semantic graph, with nodes colored by source document.
  - Two graph construction modes:
    - **Similarity Threshold:** Only show edges above a user-chosen similarity value.
    - **Top-N Neighbors:** For each node, always connect to its N most similar neighbors, ensuring a connected and informative graph.

- **Flexible Analysis Levels:**
  - Switch between document-level and chunk-level analysis for both visualizations and graphs.

- **Modern, User-Friendly UI:**
  - Clean layout, clear instructions, and interactive controls for deep exploration.

## Usage Instructions

1. **Upload Documents:**
   - Use the sidebar to upload TXT or PDF files.
   - Click "Process Uploaded Files" to add them to your workspace.

2. **Process and Analyze:**
   - Click "Chunk Loaded Documents" to segment your documents.
   - Click "Generate Embeddings" to compute semantic representations.

3. **Explore:**
   - View the similarity matrix to understand relationships.
   - Use the "Semantic Chunk Graph" section to visualize connections:
     - Choose between threshold or top-N neighbor graph modes.
     - Adjust parameters and render the graph interactively.

## Roadmap & Future Directions

- **Dataset Ingestion:**
  - While Voronoi6 currently operates on Document objects, future versions will support direct ingestion and analysis of datasets (e.g., CSV, DataFrames, tabular data).
  - This will enable semantic graphing and clustering for structured data, not just text.

- **Advanced Analytics:**
  - Planned features include semantic drift detection, knowledge ecosystem management, and more.

## Development & Contributions

- This project is under active development. Feedback and contributions are welcome!
- To run locally, see `requirements.txt` for dependencies.

## No License



