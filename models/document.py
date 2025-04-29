import dataclasses
import uuid
from typing import Optional, List, Any, Dict
import numpy as np

@dataclasses.dataclass
class Document:
    """Represents a document with its content, metadata, and optional embedding."""
    title: str
    content: str
    id: str = dataclasses.field(default_factory=lambda: str(uuid.uuid4()))
    metadata: Dict[str, Any] = dataclasses.field(default_factory=dict)
    embedding: Optional[np.ndarray] = None
    chunks: List[Any] = dataclasses.field(default_factory=list)

    def __post_init__(self):
        # Ensure embedding is None or a numpy array
        if self.embedding is not None and not isinstance(self.embedding, np.ndarray):
            try:
                self.embedding = np.array(self.embedding)
            except Exception as e:
                raise ValueError(f"Failed to convert embedding to numpy array: {e}")

    def __repr__(self) -> str:
        return f"Document(id={self.id}, title={self.title!r})"

    # Add type hints for numpy array serialization if needed later
    # This setup requires numpy arrays to be handled during serialization/deserialization 