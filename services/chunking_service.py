import re
import nltk
import numpy as np
from typing import List, Dict, Any

from models.chunk import Chunk
from models.document import Document
# from services.embedding_service import EmbeddingService # Placeholder
# from services.analysis_service import AnalysisService # Placeholder

class ContextualChunker:
    """
    Service responsible for chunking documents based on structure and semantic meaning.
    """
    def __init__(self, embedding_service: Any, analysis_service: Any): # Replace Any with actual types later
        """
        Initializes the ContextualChunker.

        Args:
            embedding_service: An instance of EmbeddingService for generating embeddings.
            analysis_service: An instance of AnalysisService for content analysis.
        """
        self.embedding_service = embedding_service
        self.analysis_service = analysis_service
        # Ensure necessary NLTK data is downloaded (if not already)
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt')


    def chunk_document(self, document: Document) -> List[Chunk]:
        """
        Chunks the given document into meaningful Chunk objects.
        It prioritizes structural chunking (e.g., by chapters) and falls back
        to a basic semantic chunking placeholder if no significant structure is found.

        Args:
            document: The Document object to chunk.

        Returns:
            A list of Chunk objects derived from the document.
        """
        if not document or not document.content:
            return []

        potential_chunks = []
        structural_chunks = self._chunk_by_structure(document)

        # --- Implement Simpler Fallback Logic ---
        if len(structural_chunks) > 1:
             # Found multiple structural chunks (e.g., chapters), use them.
             print(f"Using {len(structural_chunks)} structural chunks found for document {document.id}")
             potential_chunks = structural_chunks
        else:
             # Structure yielded 0 or 1 chunk. Fall back to semantic chunking.
             print(f"Structural chunking yielded <= 1 chunk. Falling back to semantic chunking for document {document.id}")
             potential_chunks = self._chunk_by_semantic_similarity(document.content)
             # Log result of semantic chunking
             if not potential_chunks:
                 print(f"Semantic chunking resulted in 0 chunks for document {document.id}")
             elif len(potential_chunks) == 1:
                 print(f"Semantic chunking resulted in 1 chunk for document {document.id}")
             else:
                 print(f"Used semantic chunking, resulting in {len(potential_chunks)} chunks for document {document.id}")

        # Create the final Chunk objects
        final_chunks = self._create_chunks(document, potential_chunks)
        return final_chunks

    def _chunk_by_structure(self, document: Document) -> List[Dict[str, Any]]:
        """
        Identifies potential chunks based on document structure (e.g., paragraphs, sections).
        Uses chapter headings as primary boundaries.

        Args:
            document: The Document object.

        Returns:
            A list of dictionaries, each representing a potential chunk with
            'content', 'context_label', 'start_char', 'end_char'.
        """
        content = document.content
        if not content or not content.strip():
            return []

        potential_chunks = []
        current_chunk_lines = []
        current_context_label = "Introduction" # Default label for content before the first chapter
        current_start_char = 0
        char_offset = 0
        # Regex to detect chapter headings (e.g., "CHAPTER 1", "Chapter V: Title")
        chapter_regex = re.compile(r"^\s*CHAPTER\s+([IVXLCDM\d]+)[:\.\s]*.*$", re.IGNORECASE)

        lines = content.split('\n')

        for i, line in enumerate(lines):
            line_length_with_newline = len(line) + 1 # Account for the newline character
            match = chapter_regex.match(line)

            if match:
                # Finalize the previous chunk (e.g., "Introduction" or previous chapter)
                chunk_text = "\n".join(current_chunk_lines).strip()
                if chunk_text:
                    # End char is the offset *before* this matching line starts
                    end_char = char_offset - 1 
                    potential_chunks.append({
                        'content': chunk_text,
                        'context_label': current_context_label,
                        'start_char': current_start_char,
                        'end_char': end_char
                    })

                # Start new chunk for this chapter
                current_context_label = line.strip() # Use the chapter heading as the label
                current_chunk_lines = [] # *** KEY FIX: Reset lines for the new chapter ***
                # Start char is the offset *after* this chapter heading line ends
                current_start_char = char_offset + line_length_with_newline 
            else:
                # Add line to the current chunk (intro or current chapter)
                # We keep empty lines here to preserve paragraph structure within chunks
                current_chunk_lines.append(line)

            # Update character offset after processing the line
            char_offset += line_length_with_newline

        # Add the final chunk (the content of the last chapter)
        # Use the last determined context label
        final_chunk_text = "\n".join(current_chunk_lines).strip()
        if final_chunk_text:
            potential_chunks.append({
                'content': final_chunk_text,
                'context_label': current_context_label,
                'start_char': current_start_char,
                # End char is the end of the document content
                'end_char': char_offset - 1 if content.endswith('\n') else char_offset 
            })
        # If the document was empty or only whitespace, potential_chunks remains []
        # If the document had content but no chapters, the last append handles it with "Introduction" label

        return potential_chunks

    def _chunk_by_semantic_similarity(self, text: str, similarity_threshold: float = 0.5) -> List[Dict[str, Any]]:
        """
        Identifies potential chunks by splitting text based on semantic similarity drops
        between adjacent sentences.

        Args:
            text: The raw text content to chunk.
            similarity_threshold: Cosine similarity value below which a boundary is detected.

        Returns:
            A list of dictionaries, each representing a potential chunk with
            'content', 'context_label', 'start_char', 'end_char'.
        """
        if not text or not text.strip():
            return []

        stripped_text = text.strip()

        # 1. Tokenize into sentences and find spans
        try:
            sentences_text = nltk.sent_tokenize(stripped_text)
        except Exception as e:
            print(f"NLTK sentence tokenization failed: {e}")
            # Fallback: treat the whole text as one sentence/chunk
            return [{
                'content': stripped_text,
                'context_label': 'Semantic Fallback',
                'start_char': 0,
                'end_char': len(stripped_text)
            }]

        if len(sentences_text) <= 2:
             # Not enough sentences to find meaningful breaks
             return [{
                 'content': stripped_text,
                 'context_label': 'Semantic Single Chunk',
                 'start_char': 0,
                 'end_char': len(stripped_text)
             }]
        
        sentences_data = []
        current_pos = 0
        for sent_text in sentences_text:
            try:
                start = stripped_text.find(sent_text, current_pos)
                if start == -1:
                    print(f"Warning: Could not find sentence starting point accurately for: '{sent_text[:50]}...'")
                    # Attempt rough estimate or skip?
                    # For now, let's try finding it anywhere after current_pos
                    start = stripped_text.find(sent_text, 0)
                    if start == -1:
                        print("Error: Sentence not found in text at all. Skipping sentence.")
                        continue # Skip this sentence

                end = start + len(sent_text)
                sentences_data.append({'text': sent_text, 'start': start, 'end': end, 'embedding': None})
                current_pos = end # Move search position
            except Exception as e:
                print(f"Error processing sentence span: {e} for sentence '{sent_text[:50]}...'")
                continue # Skip problematic sentences

        if len(sentences_data) <= 2:
             # After potential errors/skipping, maybe we don't have enough valid sentences
             return [{
                 'content': stripped_text,
                 'context_label': 'Semantic Single Chunk (Post-Error)',
                 'start_char': 0,
                 'end_char': len(stripped_text)
             }]

        # 2. Generate embeddings for sentences
        valid_embeddings_count = 0
        for i, sent_data in enumerate(sentences_data):
            try:
                embedding = self.embedding_service.generate_embedding(sent_data['text'])
                if embedding is not None:
                     sentences_data[i]['embedding'] = embedding
                     valid_embeddings_count += 1
            except Exception as e:
                print(f"Error generating embedding for sentence {i}: {e}")
                sentences_data[i]['embedding'] = None # Ensure it's None on error

        if valid_embeddings_count <= 1:
            print("Not enough successful sentence embeddings to calculate similarities.")
            return [{
                 'content': stripped_text,
                 'context_label': 'Semantic Single Chunk (Embedding Failed)',
                 'start_char': 0,
                 'end_char': len(stripped_text)
             }]

        # 3. Calculate similarities between adjacent sentences with valid embeddings
        similarities = []
        valid_indices_for_sim = [] # Indices in sentences_data that have embeddings
        for i, sent_data in enumerate(sentences_data):
            if sent_data['embedding'] is not None:
                valid_indices_for_sim.append(i)
        
        for k in range(len(valid_indices_for_sim) - 1):
            idx1 = valid_indices_for_sim[k]
            idx2 = valid_indices_for_sim[k+1]
            try:
                sim = self.analysis_service.calculate_similarity(
                    sentences_data[idx1]['embedding'],
                    sentences_data[idx2]['embedding']
                )
                # Store similarity and the index *before* the potential break (idx1)
                similarities.append({'index': idx1, 'score': sim})
            except Exception as e:
                 print(f"Error calculating similarity between sentences {idx1} and {idx2}: {e}")
                 # Optionally append a very low score or handle differently
                 similarities.append({'index': idx1, 'score': 0.0})

        if not similarities:
            print("No similarities could be calculated.")
            return [{
                 'content': stripped_text,
                 'context_label': 'Semantic Single Chunk (Similarity Failed)',
                 'start_char': 0,
                 'end_char': len(stripped_text)
             }]

        # 4. Detect boundaries
        boundary_indices = [] # Index of the sentence *before* the boundary
        for sim_data in similarities:
            if sim_data['score'] < similarity_threshold:
                boundary_indices.append(sim_data['index'])

        # 5. Group sentences into chunks
        potential_chunks = []
        start_sentence_idx = 0
        chunk_count = 0
        for i in range(len(sentences_data)):
            # Check if the current sentence index `i` is a boundary end point
            is_boundary = i in boundary_indices
            is_last_sentence = i == len(sentences_data) - 1

            if is_boundary or is_last_sentence:
                # Finalize the current chunk (sentences from start_sentence_idx to i)
                current_chunk_sentences_data = sentences_data[start_sentence_idx : i + 1]
                if current_chunk_sentences_data:
                    chunk_text = " ".join([s['text'] for s in current_chunk_sentences_data])
                    chunk_start_char = current_chunk_sentences_data[0]['start']
                    chunk_end_char = current_chunk_sentences_data[-1]['end']
                    chunk_count += 1
                    potential_chunks.append({
                        'content': chunk_text.strip(),
                        'context_label': f'Semantic Segment {chunk_count}',
                        'start_char': chunk_start_char,
                        'end_char': chunk_end_char
                    })
                # Set start for the next chunk
                start_sentence_idx = i + 1
        
        # If no boundaries were found, the loop finishes, and we should have one chunk
        if not potential_chunks and sentences_data:
             return [{
                 'content': stripped_text,
                 'context_label': 'Semantic Single Chunk (No Boundaries)',
                 'start_char': 0,
                 'end_char': len(stripped_text)
             }]

        return potential_chunks


    def _create_chunks(self, document: Document, potential_chunks: List[Dict[str, Any]]) -> List[Chunk]:
        """
        Converts potential chunk dictionaries into Chunk objects, adding IDs and rankings.

        Args:
            document: The source Document object.
            potential_chunks: A list of dictionaries representing potential chunks.

        Returns:
            A list of finalized Chunk objects.
        """
        final_chunks = []
        if not document or not document.id:
            # Cannot create chunks without a document ID
            # Consider logging a warning here
            return []

        for i, chunk_dict in enumerate(potential_chunks):
            if not chunk_dict or not chunk_dict.get('content'):
                continue # Skip potential chunks with no content

            chunk_id = f"{document.id}_chunk_{i}"
            context_label = chunk_dict.get('context_label', 'Unknown Context')

            chunk = Chunk(
                id=chunk_id,
                document_id=document.id,
                content=chunk_dict.get('content', ''),
                importance_rank=i + 1,  # Simple rank based on order
                key_point=context_label, # Using context label as placeholder key point
                context_label=context_label,
                start_char=chunk_dict.get('start_char'), # Will be None if key doesn't exist
                end_char=chunk_dict.get('end_char')      # Will be None if key doesn't exist
            )
            final_chunks.append(chunk)

        return final_chunks 