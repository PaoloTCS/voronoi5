# Voronoi6: Knowledge Explorer & Semantic Path Encoding

## What the App Does

Voronoi6 is an interactive knowledge exploration and analysis tool that transforms collections of documents (TXT, PDF, code, etc.) into a dynamic, visual semantic network. It leverages advanced embedding models and graph algorithms to:

- **Chunk and embed documents** into semantically meaningful units.
- **Visualize** the relationships between documents and their chunks in 2D/3D UMAP space.
- **Construct a semantic graph** where nodes are document chunks and edges represent strong semantic similarity.
- **Enable path encoding** between nodes using Gödel-style, order-preserving number theory (prime-based) encoding, allowing for unique, reversible representations of semantic paths.
- **Provide rich UI feedback** about graph connectivity, path existence, and graph structure.

## Current Capabilities

- **Document Upload & Processing:**
  - Upload TXT and PDF files.
  - Chunk documents using contextual and structural cues.
  - Generate embeddings for documents and chunks.

- **Visualization & Analysis:**
  - 2D and 3D UMAP projections of semantic space.
  - Interactive selection and analysis of clusters and points.
  - Pairwise similarity matrix for documents or chunks.

- **Semantic Graph Construction:**
  - Build a graph using either similarity threshold or top-N neighbors.
  - Visualize the semantic chunk graph with color-coded nodes.
  - Inspect node connectivity and graph metrics.

- **Path Encoding (Phase 3 Dev):**
  - Select start and end nodes (chunks) in the semantic graph.
  - Find and encode the path between them using Gödel-style encoding:  
    \( C = P_1^{e_1} \times P_2^{e_2} \times \ldots \times P_k^{e_k} \)
  - Decode the Gödel number to recover the exact ordered path.
  - UI explains why paths may not exist (isolated nodes, disconnected components, etc.) and shows reachable nodes/components.

## Where the Project is Going (Vision & Next Steps)

- **Advanced Path Encoding:**
  - Support for multi-level/lifted Gödel encoding (block-based, recursive compression).
  - Integration of path encoding with knowledge claims, provenance, and "SuperTokens" for verifiable knowledge paths.

- **Semantic Shadow & Drift Detection:**
  - Track how concepts evolve over time and across document versions.
  - Visualize and quantify "semantic drift" and knowledge gaps.

- **Private & Team Knowledge Graphs:**
  - Enable secure, collaborative knowledge graph construction and sharing.
  - Support for user roles, permissions, and private knowledge ecosystems.

- **Enhanced UI/UX:**
  - More intuitive graph exploration and pathfinding tools.
  - Highlighting of connected components and semantic communities.
  - Customizable graph construction and analysis parameters.

- **Extensibility:**
  - Plug-in architecture for new embedding models, chunkers, and graph algorithms.
  - API for programmatic access and integration with other research tools.

## Recent Progress (Changelog)

- Implemented Gödel-style, order-preserving path encoding and decoding using gmpy2.
- Refactored UI to provide actionable feedback on path existence and graph connectivity.
- Added display of reachable nodes and connected component size when no path exists.
- Improved sidebar and main area for document/chunk analysis and visualization.

---

*This file will be updated as the project evolves. For questions or suggestions, see the main README or contact the project maintainer.* 