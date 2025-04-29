import plotly.express as px
import numpy as np
from typing import List
import plotly.graph_objects as go # Import go for figure type hint

class VisualizationService:
    """Handles the creation of visualizations for embedding data."""

    def plot_scatter_2d(
        self, 
        coords: np.ndarray, 
        labels: List[str], 
        title: str = "2D Document Visualization"
    ) -> go.Figure:
        """Creates a 2D scatter plot from coordinates and labels."""
        if not isinstance(coords, np.ndarray) or coords.ndim != 2 or coords.shape[1] != 2:
            raise ValueError("Coordinates must be a 2D numpy array with shape (n, 2).")
        if not isinstance(labels, list) or len(labels) != coords.shape[0]:
            raise ValueError(f"Labels must be a list with length matching the number of coordinate rows ({coords.shape[0]}).")
        
        fig = px.scatter(
            x=coords[:, 0],
            y=coords[:, 1],
            # text=labels, # Remove direct text rendering on plot
            hover_name=labels, # Use hover_name for better default hover
            title=title
        )
        # Update hover template for clarity (using hover_name)
        fig.update_traces(hovertemplate="<b>%{hover_name}</b><br>x: %{x:.3f}<br>y: %{y:.3f}<extra></extra>")
        # Ensure only markers are shown, no text labels on plot
        fig.update_traces(mode='markers')
        return fig

    def plot_scatter_3d(
        self, 
        coords: np.ndarray, 
        labels: List[str], 
        title: str = "3D Document Visualization"
    ) -> go.Figure:
        """Creates a 3D scatter plot from coordinates and labels."""
        if not isinstance(coords, np.ndarray) or coords.ndim != 2 or coords.shape[1] != 3:
            raise ValueError("Coordinates must be a 2D numpy array with shape (n, 3).")
        if not isinstance(labels, list) or len(labels) != coords.shape[0]:
            raise ValueError(f"Labels must be a list with length matching the number of coordinate rows ({coords.shape[0]}).")

        fig = px.scatter_3d(
            x=coords[:, 0],
            y=coords[:, 1],
            z=coords[:, 2],
            text=labels, # Use text for hover info
            title=title
        )
        # Update hover template for clarity
        fig.update_traces(hovertemplate="<b>%{text}</b><br>x: %{x:.3f}<br>y: %{y:.3f}<br>z: %{z:.3f}<extra></extra>")
        return fig 