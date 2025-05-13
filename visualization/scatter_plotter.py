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
        color_discrete_map: Optional[dict] = None,
        edges: Optional[List[tuple]] = None,  # List of (i, j, weight)
        draw_ellipses: bool = False,
        ellipse_alpha: float = 0.15,
        ellipse_line_width: int = 2
    ) -> go.Figure:
        """Creates a 2D scatter plot from coordinates and labels, optionally colored, with optional edges and ellipses for clusters."""
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
        fig.update_traces(mode='markers')

        # --- Draw edges if provided ---
        if edges:
            edge_x = []
            edge_y = []
            edge_widths = []
            for i, j, weight in edges:
                edge_x += [coords[i, 0], coords[j, 0], None]
                edge_y += [coords[i, 1], coords[j, 1], None]
                edge_widths.append(weight)
            # Normalize edge widths for visibility
            if edge_widths:
                min_w, max_w = min(edge_widths), max(edge_widths)
                norm_widths = [1 + 6 * ((w - min_w) / (max_w - min_w) if max_w > min_w else 1) for w in edge_widths]
            else:
                norm_widths = [2] * len(edges)
            # Add as a single trace for all edges
            fig.add_trace(go.Scatter(
                x=edge_x,
                y=edge_y,
                mode='lines',
                line=dict(width=2, color='rgba(100,100,100,0.4)'),
                hoverinfo='none',
                showlegend=False
            ))

        # --- Draw ellipses (or convex hulls) for each document group ---
        if draw_ellipses and color_categories is not None:
            import pandas as pd
            from scipy.spatial import ConvexHull  # noqa: F401
            import plotly.colors
            df = pd.DataFrame({'x': coords[:, 0], 'y': coords[:, 1], 'doc': color_categories})
            unique_docs = df['doc'].unique()
            color_map = color_discrete_map or {doc: plotly.colors.DEFAULT_PLOTLY_COLORS[i % 10] for i, doc in enumerate(unique_docs)}
            for doc in unique_docs:
                group = df[df['doc'] == doc]
                if len(group) < 3:
                    continue  # Need at least 3 points for a hull
                points = group[['x', 'y']].values
                try:
                    hull = ConvexHull(points)
                    hull_points = points[hull.vertices]
                    # Close the hull
                    hull_points = np.concatenate([hull_points, hull_points[:1]], axis=0)
                    fig.add_trace(go.Scatter(
                        x=hull_points[:, 0],
                        y=hull_points[:, 1],
                        mode='lines',
                        line=dict(color=color_map.get(doc, '#888'), width=ellipse_line_width, dash='dot'),
                        fill='toself',
                        fillcolor=plotly.colors.hex_to_rgb(color_map.get(doc, '#888')) + (ellipse_alpha,),
                        opacity=ellipse_alpha,
                        name=f'{doc} boundary',
                        showlegend=False
                    ))
                except Exception:
                    continue
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