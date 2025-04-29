import dataclasses
from typing import Optional
import numpy as np

@dataclasses.dataclass
class Chunk:
    """Represents a chunk of text extracted from a document."""
    id: str
    document_id: str
    content: str
    importance_rank: int
    key_point: str  # The main idea this chunk represents
    context_label: str  # e.g., chapter title, topic name
    start_char: Optional[int] = None
    end_char: Optional[int] = None
    embedding: Optional[np.ndarray] = None

    def __repr__(self):
        return (
            f"Chunk(id={self.id!r}, document_id={self.document_id!r}, "
            f"importance_rank={self.importance_rank}, "
            f"key_point={self.key_point!r}, context_label={self.context_label!r}, "
            f"content='{self.content[:50]}...', "
            f"start_char={self.start_char}, end_char={self.end_char}, "
            f"has_embedding={'Yes' if self.embedding is not None else 'No'})"
        ) 