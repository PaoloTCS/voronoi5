# Future Plans & Ideas

This document outlines potential future directions and features for the semantic visualization application.

## 1. Higher-Dimensional Semantic Visualization (N-Simplex)

*   **Goal:** Extend the visualization beyond 3D tetrahedra to represent semantic relationships between *n* documents (where *n* > 4) using n-simplexes.
*   **Concept:**
    *   Each n-simplex represents a combination of *n* documents.
    *   Interior points represent weighted semantic combinations of these *n* documents.
*   **Implementation Ideas:**
    *   **New Panel:** Create a dedicated panel (potentially below the main 2D/3D visualization) to display representations of these higher-dimensional structures.
    *   **Dimensionality Reduction/Projection:** Since we can't directly view >3 dimensions, explore techniques to project or slice the n-dimensional simplex into a comprehensible 2D or 3D view.
        *   Could involve techniques like UMAP (already used), t-SNE, PCA, or custom projection methods focused on barycentric coordinates.
        *   Consider interactive slicing or projection controls.
    *   **Interior Point Analysis:** Adapt the existing point selection and analysis mechanisms:
        *   Allow users to select points within the projected/sliced representation.
        *   Calculate barycentric coordinates relative to the *n* vertices.
        *   Generate linguistic descriptions (using the LLM) of the semantic meaning of these higher-dimensional interior points based on their n-dimensional contributions.
*   **Challenges:**
    *   Finding intuitive ways to visualize and interact with projections of higher-dimensional geometric shapes.
    *   Computational cost of calculating embeddings and potentially projections for larger *n*.
    *   Developing meaningful prompts for the LLM to describe n-dimensional semantic blends.

## 2. Other Potential Enhancements

*   (Add other ideas as they arise) 