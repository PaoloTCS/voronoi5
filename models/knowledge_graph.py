from __future__ import annotations # Enables forward reference for type hints
import dataclasses
import uuid
from typing import Optional, List, Dict, Any, Set, Tuple
import numpy as np
import networkx as nx
# Potentially import Chunk and Document if needed for type hints,
# but try to keep models independent if possible. Use forward references if needed.

@dataclasses.dataclass
class KnowledgeNode:
    """Represents a node in the knowledge graph (document or chunk)."""
    id: str
    node_type: str  # 'document' or 'chunk'
    content_id: str  # ID of the source Document or Chunk object
    embedding: Optional[np.ndarray] = None # Store embedding here too if useful
    properties: Dict[str, Any] = dataclasses.field(default_factory=dict) # e.g., title, key_point, centrality

    def __repr__(self) -> str:
        return f"KnowledgeNode(id={self.id}, type={self.node_type}, content_id={self.content_id})"

@dataclasses.dataclass
class KnowledgeEdge:
    """Represents a relationship (edge) between two nodes."""
    id: str
    source_id: str
    target_id: str
    relationship_type: str  # e.g., 'contains', 'similarity', 'derivation', 'reference'
    weight: float = 1.0
    properties: Dict[str, Any] = dataclasses.field(default_factory=dict)

    def __repr__(self) -> str:
        return f"KnowledgeEdge(source={self.source_id}, target={self.target_id}, type={self.relationship_type}, weight={self.weight:.4f})"

class KnowledgeGraph:
    """Represents the topological structure of knowledge as a graph."""
    def __init__(self, name: str = "Knowledge Graph"):
        self.id = str(uuid.uuid4())
        self.name = name
        self.nodes: Dict[str, KnowledgeNode] = {}
        self.edges: Dict[str, KnowledgeEdge] = {}
        self.graph = nx.Graph() # Underlying NetworkX graph
        self.metrics: Dict[str, Any] = {}
        self.semantic_gaps: List[Dict[str, Any]] = []
        self.clusters: List[Dict[str, Any]] = []

    def add_node(self, node: KnowledgeNode) -> str:
        """Add a node to the graph."""
        if node.id in self.nodes: return node.id # Avoid duplicates
        self.nodes[node.id] = node
        self.graph.add_node(node.id, **node.__dict__) # Add node with all attributes
        return node.id

    def add_edge(self, edge: KnowledgeEdge) -> str:
        """Add an edge to the graph."""
        # Ensure source and target nodes exist before adding edge
        if edge.source_id not in self.nodes or edge.target_id not in self.nodes:
            print(f"Warning: Cannot add edge {edge.id}. Source or target node missing.")
            return ""
        if edge.id in self.edges: return edge.id # Avoid duplicates
        self.edges[edge.id] = edge
        self.graph.add_edge(edge.source_id, edge.target_id, id=edge.id, **edge.__dict__)
        return edge.id

    def remove_node(self, node_id: str) -> None:
        """Remove a node and its connected edges."""
        if node_id in self.nodes:
            edges_to_remove = list(self.graph.edges(node_id)) # Find incident edges
            self.graph.remove_node(node_id) # Remove from networkx graph
            del self.nodes[node_id] # Remove from our dict
            # Remove corresponding edges from our edge dict
            for edge_tuple in edges_to_remove:
                 # Find edge ID based on source/target (might need better edge storage)
                 # This part is tricky if edge IDs aren't easily searchable
                 # For now, assume graph removal is sufficient for NetworkX analysis
                 pass # Placeholder for removing from self.edges dict if needed


    def get_neighbors(self, node_id: str) -> List[str]:
        """Get IDs of neighboring nodes."""
        if node_id not in self.graph: return []
        return list(self.graph.neighbors(node_id))

    # --- Add calculate_metrics, detect_clusters, identify_semantic_gaps ---
    # --- from voronoi5-5/models/knowledge_graph.py if desired ---
    # --- Or we can implement them later based on AnalysisService ---
    # Example placeholder:
    def calculate_metrics(self) -> Dict[str, Any]:
         """Placeholder for calculating graph metrics."""
         self.metrics = {'node_count': self.graph.number_of_nodes(), 'edge_count': self.graph.number_of_edges()}
         print("Placeholder: Calculate Metrics")
         return self.metrics

    def detect_clusters(self) -> List[Dict[str, Any]]:
         """Placeholder for detecting clusters."""
         self.clusters = []
         print("Placeholder: Detect Clusters")
         return self.clusters

    def identify_semantic_gaps(self) -> List[Dict[str, Any]]:
         """Placeholder for identifying gaps."""
         self.semantic_gaps = []
         print("Placeholder: Identify Gaps")
         return self.semantic_gaps

    def to_dict(self) -> Dict[str, Any]:
        """Convert graph to a dictionary."""
        # Basic implementation, might need refinement for serialization
        return {
            'id': self.id, 'name': self.name,
            'nodes': {nid: n.__dict__ for nid, n in self.nodes.items()},
            'edges': {eid: e.__dict__ for eid, e in self.edges.items()},
            'metrics': self.metrics, 'clusters': self.clusters, 'semantic_gaps': self.semantic_gaps
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'KnowledgeGraph':
        """Create graph from dictionary."""
        graph = cls(name=data.get('name', 'Knowledge Graph'))
        graph.id = data.get('id', str(uuid.uuid4()))
        for node_id, node_data in data.get('nodes', {}).items():
            # Basic reconstruction, assumes node_data matches KnowledgeNode fields
            graph.add_node(KnowledgeNode(id=node_id, **node_data))
        for edge_id, edge_data in data.get('edges', {}).items():
             # Basic reconstruction, assumes edge_data matches KnowledgeEdge fields
             graph.add_edge(KnowledgeEdge(id=edge_id, **edge_data))
        graph.metrics = data.get('metrics', {})
        graph.clusters = data.get('clusters', [])
        graph.semantic_gaps = data.get('semantic_gaps', [])
        return graph 