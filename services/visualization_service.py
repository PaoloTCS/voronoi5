import plotly.express as px
import numpy as np
from typing import List, Optional
import plotly.graph_objects as go # Import go for figure type hint

class VisualizationService:
    """Handles the creation of visualizations for embedding data."""

    def plot_scatter_2d(
        self, 
        coords: np.ndarray, 
        labels: List[str], 
        title: str = "2D Document Visualization",
        color_categories: Optional[List[str]] = None,
        color_discrete_map: Optional[dict] = None
    ) -> go.Figure:
        """Creates a 2D scatter plot from coordinates and labels, optionally colored."""
        if not isinstance(coords, np.ndarray) or coords.ndim != 2 or coords.shape[1] != 2:
            raise ValueError("Coordinates must be a 2D numpy array with shape (n, 2).")
        if not isinstance(labels, list) or len(labels) != coords.shape[0]:
            raise ValueError(f"Labels must be a list with length matching the number of coordinate rows ({coords.shape[0]}).")
        if color_categories is not None and len(color_categories) != coords.shape[0]:
             raise ValueError(f"Color categories must be None or a list with length matching coordinate rows ({coords.shape[0]}).")

        
        fig = px.scatter(
            x=coords[:, 0],
            y=coords[:, 1],
            hover_name=labels, 
            title=title,
            color=color_categories,
            color_discrete_map=color_discrete_map,
            labels={'color': 'Source Document'} if color_categories else None 
        )
        # Ensure only markers are shown. Hover behavior should come from hover_name.
        fig.update_traces(mode='markers')
        # Optional: Adjust legend position
        # fig.update_layout(legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01))
        return fig

    def plot_scatter_3d(
        self, 
        coords: np.ndarray, 
        labels: List[str], 
        title: str = "3D Document Visualization",
        color_data: Optional[List[str]] = None
    ) -> go.Figure:
        """Creates a 3D scatter plot from coordinates and labels."""
        if not isinstance(coords, np.ndarray) or coords.ndim != 2 or coords.shape[1] != 3:
            raise ValueError("Coordinates must be a 2D numpy array with shape (n, 3).")
        if not isinstance(labels, list) or len(labels) != coords.shape[0]:
            raise ValueError(f"Labels must be a list with length matching the number of coordinate rows ({coords.shape[0]}).")
        if color_data is not None and len(color_data) != coords.shape[0]:
             raise ValueError(f"Color data must be None or a list with length matching coordinate rows ({coords.shape[0]}).")

        fig = px.scatter_3d(
            x=coords[:, 0],
            y=coords[:, 1],
            z=coords[:, 2],
            text=labels, # Use labels for hover text
            title=title,
            color=color_data, # Use color data for point colors
            labels={'color': 'Source'} if color_data else None # Add legend title if color is used
        )
        # Update hover template for clarity
        fig.update_traces(hovertemplate="<b>%{text}</b><br>x: %{x:.3f}<br>y: %{y:.3f}<br>z: %{z:.3f}<extra></extra>")
        return fig 