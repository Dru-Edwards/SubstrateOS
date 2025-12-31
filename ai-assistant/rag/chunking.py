"""
Document Chunking Strategies for RAG.

Multiple strategies are implemented for evaluation:
1. Fixed-size chunking
2. Semantic chunking (paragraph/section based)
3. Recursive character splitting
"""

import re
from dataclasses import dataclass
from typing import List

import structlog

logger = structlog.get_logger()


@dataclass
class Chunk:
    """A document chunk."""
    id: str
    content: str
    metadata: dict
    start_index: int
    end_index: int


class ChunkingStrategy:
    """Base class for chunking strategies."""
    
    def chunk(self, text: str, doc_id: str, metadata: dict = None) -> List[Chunk]:
        raise NotImplementedError


class FixedSizeChunker(ChunkingStrategy):
    """
    Fixed-size chunking with overlap.
    
    Simple but effective baseline strategy.
    """
    
    def __init__(self, chunk_size: int = 512, overlap: int = 50):
        self.chunk_size = chunk_size
        self.overlap = overlap
    
    def chunk(self, text: str, doc_id: str, metadata: dict = None) -> List[Chunk]:
        metadata = metadata or {}
        chunks = []
        
        start = 0
        chunk_idx = 0
        
        while start < len(text):
            end = min(start + self.chunk_size, len(text))
            
            # Try to end at sentence boundary
            if end < len(text):
                # Look for sentence end within last 50 chars
                sentence_end = text.rfind('. ', start + self.chunk_size - 50, end)
                if sentence_end > start:
                    end = sentence_end + 1
            
            chunk_text = text[start:end].strip()
            
            if chunk_text:
                chunks.append(Chunk(
                    id=f"{doc_id}_chunk_{chunk_idx}",
                    content=chunk_text,
                    metadata={**metadata, "chunk_index": chunk_idx},
                    start_index=start,
                    end_index=end
                ))
                chunk_idx += 1
            
            start = end - self.overlap
        
        return chunks


class SemanticChunker(ChunkingStrategy):
    """
    Semantic chunking based on document structure.
    
    Respects paragraph and section boundaries.
    """
    
    def __init__(self, max_chunk_size: int = 1000, min_chunk_size: int = 100):
        self.max_chunk_size = max_chunk_size
        self.min_chunk_size = min_chunk_size
    
    def chunk(self, text: str, doc_id: str, metadata: dict = None) -> List[Chunk]:
        metadata = metadata or {}
        chunks = []
        
        # Split on section headers (markdown style)
        sections = re.split(r'\n(?=#{1,3}\s)', text)
        
        current_chunk = ""
        current_start = 0
        chunk_idx = 0
        
        for section in sections:
            # If section alone is too big, split by paragraphs
            if len(section) > self.max_chunk_size:
                paragraphs = section.split('\n\n')
                for para in paragraphs:
                    if len(current_chunk) + len(para) > self.max_chunk_size:
                        if len(current_chunk) >= self.min_chunk_size:
                            chunks.append(Chunk(
                                id=f"{doc_id}_chunk_{chunk_idx}",
                                content=current_chunk.strip(),
                                metadata={**metadata, "chunk_index": chunk_idx},
                                start_index=current_start,
                                end_index=current_start + len(current_chunk)
                            ))
                            chunk_idx += 1
                        current_chunk = para
                        current_start = text.find(para)
                    else:
                        current_chunk += "\n\n" + para
            else:
                if len(current_chunk) + len(section) > self.max_chunk_size:
                    if len(current_chunk) >= self.min_chunk_size:
                        chunks.append(Chunk(
                            id=f"{doc_id}_chunk_{chunk_idx}",
                            content=current_chunk.strip(),
                            metadata={**metadata, "chunk_index": chunk_idx},
                            start_index=current_start,
                            end_index=current_start + len(current_chunk)
                        ))
                        chunk_idx += 1
                    current_chunk = section
                    current_start = text.find(section)
                else:
                    current_chunk += "\n" + section
        
        # Don't forget the last chunk
        if len(current_chunk) >= self.min_chunk_size:
            chunks.append(Chunk(
                id=f"{doc_id}_chunk_{chunk_idx}",
                content=current_chunk.strip(),
                metadata={**metadata, "chunk_index": chunk_idx},
                start_index=current_start,
                end_index=len(text)
            ))
        
        return chunks


class CodeAwareChunker(ChunkingStrategy):
    """
    Chunking strategy for code files.
    
    Respects function/class boundaries.
    """
    
    def __init__(self, max_chunk_size: int = 1500):
        self.max_chunk_size = max_chunk_size
    
    def chunk(self, text: str, doc_id: str, metadata: dict = None) -> List[Chunk]:
        metadata = metadata or {}
        chunks = []
        
        # Split on function/class definitions
        # This is a simple heuristic - production would use AST parsing
        pattern = r'\n(?=(?:def |class |function |const |export ))'
        sections = re.split(pattern, text)
        
        current_chunk = ""
        chunk_idx = 0
        
        for section in sections:
            if len(current_chunk) + len(section) > self.max_chunk_size:
                if current_chunk.strip():
                    chunks.append(Chunk(
                        id=f"{doc_id}_chunk_{chunk_idx}",
                        content=current_chunk.strip(),
                        metadata={**metadata, "chunk_index": chunk_idx, "type": "code"},
                        start_index=0,  # Simplified
                        end_index=0
                    ))
                    chunk_idx += 1
                current_chunk = section
            else:
                current_chunk += section
        
        if current_chunk.strip():
            chunks.append(Chunk(
                id=f"{doc_id}_chunk_{chunk_idx}",
                content=current_chunk.strip(),
                metadata={**metadata, "chunk_index": chunk_idx, "type": "code"},
                start_index=0,
                end_index=0
            ))
        
        return chunks


def get_chunker(strategy: str = "fixed", **kwargs) -> ChunkingStrategy:
    """Factory function to get chunking strategy."""
    strategies = {
        "fixed": FixedSizeChunker,
        "semantic": SemanticChunker,
        "code": CodeAwareChunker
    }
    
    if strategy not in strategies:
        raise ValueError(f"Unknown chunking strategy: {strategy}")
    
    return strategies[strategy](**kwargs)
