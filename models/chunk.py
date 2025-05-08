import dataclasses
from typing import Optional, List, Dict, Any
import numpy as np
import uuid

@dataclasses.dataclass
class Chunk:
    """
    Represents a chunk of text extracted from a document.
    Incorporates fields for knowledge topology analysis.
    """
    id: str
    document_id: str
    content: str
    importance_rank: int
    key_point: str  # The main idea this chunk represents
    context_label: str  # e.g., chapter title, topic name
    start_char: Optional[int] = None
    end_char: Optional[int] = None
    embedding: Optional[np.ndarray] = None

    # New fields for knowledge topology analysis
    semantic_neighbors: List[str] = dataclasses.field(default_factory=list)
    centrality_score: Optional[float] = None
    semantic_uniqueness: Optional[float] = None
    boundary_score: Optional[float] = None
    bridge_score: Optional[float] = None
    knowledge_path_scores: Dict[str, float] = dataclasses.field(default_factory=dict)
    territory_size: Optional[float] = None
    territory_overlap: Dict[str, float] = dataclasses.field(default_factory=dict)

    def __post_init__(self):
         # Ensure embedding is None or a numpy array
         if self.embedding is not None and not isinstance(self.embedding, np.ndarray):
            try:
                self.embedding = np.array(self.embedding, dtype=float)
            except Exception as e:
                print(f"Warning: Failed to convert chunk embedding to numpy array for chunk {self.id}. Setting to None. Error: {e}")
                self.embedding = None

    def __repr__(self):
        centrality_str = f", centrality={self.centrality_score:.2f}" if self.centrality_score else ""
        return (
            f"Chunk(id={self.id!r}, doc_id={self.document_id!r}, "
            f"rank={self.importance_rank}, key_point={self.key_point!r}, "
            f"label={self.context_label!r}{centrality_str})"
        )

    def get_summary(self) -> str:
        """Returns a summary of the chunk with its key metrics."""
        summary = f"Chunk: {self.key_point}\n"
        summary += f"ID: {self.id}\nFrom Document: {self.document_id}\n"
        summary += f"Context: {self.context_label}\nImportance Rank: {self.importance_rank}\n"
        summary += f"Length: {len(self.content)} characters\n"
        if self.centrality_score is not None: summary += f"Graph Centrality: {self.centrality_score:.4f}\n"
        if self.semantic_uniqueness is not None: summary += f"Semantic Uniqueness: {self.semantic_uniqueness:.4f}\n"
        if self.boundary_score is not None: summary += f"Boundary Score: {self.boundary_score:.4f}\n"
        if self.bridge_score is not None: summary += f"Bridge Score: {self.bridge_score:.4f}\n"
        if self.semantic_neighbors: summary += f"Semantic Neighbors: {len(self.semantic_neighbors)}\n"
        if self.territory_size is not None: summary += f"Territory Size: {self.territory_size:.4f}\n"
        summary += f"\nContent Preview: {self.content[:100]}...\n"
        return summary

    @classmethod
    def from_text(cls, text: str, document_id: str, context_label: str = "Unknown") -> 'Chunk':
        """Create a chunk directly from text with minimal metadata."""
        chunk_id = f"{document_id}_chunk_{str(uuid.uuid4())[:8]}"
        return cls(
            id=chunk_id, document_id=document_id, content=text,
            importance_rank=1, key_point=context_label, context_label=context_label
        ) 