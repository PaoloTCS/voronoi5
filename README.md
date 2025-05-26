# Voronoi6: Semantic Knowledge Explorer

**Live Demo:** [voronoi6-eupbzd4aanxptzehyeykkz.streamlit.app](https://voronoi6-eupbzd4aanxptzehyeykkz.streamlit.app)

Voronoi6 is an interactive Streamlit app for exploring the semantic structure of your documents. It uses advanced embedding, clustering, and graph techniques to reveal hidden relationships and conceptual clusters in your information.

## Key Features

- **Flexible Document Upload:** Supports TXT, PDF, and CSV file formats.
  - For CSV files, an interactive column selection allows you to specify which parts of your tabular data to analyze as text.
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

1.  **Upload Documents:**
    -   Use the sidebar to upload TXT, PDF, or **CSV** files.
    -   Click "Process Uploaded Files" to add them to your workspace.
    -   **For CSV files:** After a CSV file is loaded, you will be prompted in the sidebar to select which columns contain the text data you wish to analyze. Each row's combined text from these selected columns will then be treated as a separate document for subsequent processing and analysis.

2.  **Process and Analyze:**
    -   After processing uploaded files (and selecting columns for CSVs), click "Chunk Loaded Documents" to segment your documents into smaller, meaningful passages.
    -   Then, click "Generate Embeddings" to compute the semantic representations for both documents and chunks.

3.  **Explore:**
    -   View the similarity matrix to understand relationships at the document or chunk level.
    -   Use the "Semantic Chunk Graph" section to visualize connections:
        -   Choose between threshold-based or top-N neighbor graph construction modes.
        -   Adjust parameters and render the graph interactively to explore semantic structures.
    -   Utilize other analysis tools like N-simplex analysis, nearest neighbors, and embedding space visualizations.

## Roadmap & Future Directions

- **Enhanced Data Ingestion & Analysis:**
  - Voronoi6 now supports CSV file uploads, allowing users to select specific columns for text analysis where each relevant row is treated as an individual document.
  - Future plans include deeper analysis capabilities for tabular and structured data, potentially incorporating metadata more directly into the semantic models, and exploring mixed data types.

- **Advanced Analytics:**
  - Planned features include semantic drift detection over time or versions, knowledge ecosystem management tools, and more sophisticated graph-based analytical measures.

## Development & Contributions

- This project is under active development. Feedback and contributions are welcome!
- To run locally, see `requirements.txt` for dependencies.

## No License
