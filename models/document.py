from __future__ import annotations
import dataclasses
import uuid
from typing import Optional, List, Any, Dict
import numpy as np

@dataclasses.dataclass
class Document:
    """
    Represents a document with its content, metadata, and optional embedding.
    Incorporates fields for knowledge topology analysis.
    """
    title: str
    content: str
    id: str = dataclasses.field(default_factory=lambda: str(uuid.uuid4()))
    metadata: Dict[str, Any] = dataclasses.field(default_factory=dict)
    embedding: Optional[np.ndarray] = None
    chunks: List['Chunk'] = dataclasses.field(default_factory=list) # Use 'Chunk' type hint after defining Chunk

    # New fields for knowledge topology analysis
    knowledge_domain: Optional[str] = None
    knowledge_density: Optional[float] = None
    centrality_score: Optional[float] = None # Graph-level score

    def __post_init__(self):
        # Ensure embedding is None or a numpy array
        if self.embedding is not None and not isinstance(self.embedding, np.ndarray):
            try:
                # Attempt conversion, raise error if fails
                self.embedding = np.array(self.embedding, dtype=float)
            except Exception as e:
                print(f"Warning: Failed to convert document embedding to numpy array for doc {self.id}. Setting to None. Error: {e}")
                self.embedding = None

    def __repr__(self) -> str:
        domain_str = f", domain={self.knowledge_domain}" if self.knowledge_domain else ""
        return f"Document(id={self.id}, title={self.title!r}{domain_str})"

    def get_summary(self) -> str:
        """Returns a summary of the document based on metadata and key statistics."""
        chunk_count = len(self.chunks)
        summary = f"Document: {self.title}\n"
        summary += f"ID: {self.id}\n"
        summary += f"Length: {len(self.content)} characters\n"
        summary += f"Chunks: {chunk_count}\n"
        if self.knowledge_domain: summary += f"Knowledge Domain: {self.knowledge_domain}\n"
        if self.knowledge_density is not None: summary += f"Knowledge Density: {self.knowledge_density:.4f}\n"
        if self.centrality_score is not None: summary += f"Graph Centrality: {self.centrality_score:.4f}\n"
        if self.metadata:
            summary += "Metadata:\n"
            for key, value in self.metadata.items(): summary += f"  - {key}: {value}\n"
        return summary

    def calculate_knowledge_metrics(self) -> Dict[str, float]:
        """Calculate various knowledge metrics for this document."""
        metrics = {}
        metrics['word_count'] = len(self.content.split())
        metrics['chunk_count'] = len(self.chunks)
        words = self.content.lower().split()
        metrics['knowledge_density'] = len(set(words)) / max(1, len(words))
        self.knowledge_density = metrics['knowledge_density']
        return metrics

    # Add type hints for numpy array serialization if needed later
    # This setup requires numpy arrays to be handled during serialization/deserialization 