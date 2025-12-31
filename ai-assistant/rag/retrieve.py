"""
RAG Retrieval - Vector search and reranking.
"""

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import numpy as np
import structlog

logger = structlog.get_logger()


@dataclass
class RetrievalResult:
    """A retrieved document chunk."""
    id: str
    content: str
    score: float
    metadata: dict


class RAGRetriever:
    """
    Retriever with vector search and optional reranking.
    
    Supports:
    - FAISS for local vector storage
    - pgvector for PostgreSQL
    - Semantic + keyword hybrid search
    """
    
    def __init__(self, vector_path: str):
        self.vector_path = Path(vector_path)
        self.index = None
        self.chunks = []
        self.embedding_model = None
        
        self._load_index()
    
    def _load_index(self):
        """Load FAISS index and chunk metadata."""
        import faiss
        
        index_file = self.vector_path / "index.faiss"
        chunks_file = self.vector_path / "chunks.json"
        
        if not index_file.exists():
            logger.warning("Index file not found", path=str(index_file))
            return
        
        # Load FAISS index
        self.index = faiss.read_index(str(index_file))
        
        # Load chunk metadata
        if chunks_file.exists():
            with open(chunks_file) as f:
                self.chunks = json.load(f)
        
        # Initialize embedding model
        from rag.embed import get_embedding_model
        self.embedding_model = get_embedding_model(
            os.getenv("EMBEDDING_MODEL_TYPE", "openai"),
            model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
        )
        
        logger.info(
            "RAG index loaded",
            chunks=len(self.chunks),
            dimensions=self.index.d
        )
    
    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
        threshold: float = 0.0,
        rerank: bool = True
    ) -> List[RetrievalResult]:
        """
        Retrieve relevant chunks for a query.
        
        Args:
            query: Search query
            top_k: Number of results to return
            threshold: Minimum similarity score
            rerank: Whether to rerank results
        
        Returns:
            List of RetrievalResult
        """
        if self.index is None:
            raise RuntimeError("Index not loaded")
        
        # Generate query embedding
        query_embedding = self.embedding_model.embed([query])[0]
        
        # Search (retrieve more if reranking)
        search_k = top_k * 3 if rerank else top_k
        
        distances, indices = self.index.search(
            np.array([query_embedding]).astype('float32'),
            search_k
        )
        
        # Convert to results
        results = []
        for i, (dist, idx) in enumerate(zip(distances[0], indices[0])):
            if idx < 0 or idx >= len(self.chunks):
                continue
            
            chunk = self.chunks[idx]
            # FAISS uses L2 distance, convert to similarity
            score = 1.0 / (1.0 + dist)
            
            if score >= threshold:
                results.append(RetrievalResult(
                    id=chunk.get("id", f"chunk_{idx}"),
                    content=chunk.get("content", ""),
                    score=score,
                    metadata=chunk.get("metadata", {})
                ))
        
        # Rerank if enabled
        if rerank and len(results) > top_k:
            results = await self._rerank(query, results, top_k)
        
        return results[:top_k]
    
    async def _rerank(
        self,
        query: str,
        results: List[RetrievalResult],
        top_k: int
    ) -> List[RetrievalResult]:
        """
        Rerank results using cross-encoder or LLM.
        
        Simple scoring rerank - production would use a cross-encoder.
        """
        # Simple keyword boost for now
        query_words = set(query.lower().split())
        
        for result in results:
            content_words = set(result.content.lower().split())
            overlap = len(query_words & content_words)
            # Boost score by keyword overlap
            result.score += overlap * 0.05
        
        # Sort by score
        results.sort(key=lambda x: x.score, reverse=True)
        
        return results[:top_k]
    
    async def get_stats(self) -> dict:
        """Get retriever statistics."""
        return {
            "total_chunks": len(self.chunks),
            "embedding_model": os.getenv("EMBEDDING_MODEL", "unknown"),
            "dimensions": self.index.d if self.index else 0,
            "vector_path": str(self.vector_path)
        }


class HybridRetriever(RAGRetriever):
    """
    Hybrid retriever combining semantic and keyword search.
    """
    
    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
        threshold: float = 0.0,
        rerank: bool = True,
        semantic_weight: float = 0.7
    ) -> List[RetrievalResult]:
        """
        Hybrid search combining semantic and keyword matching.
        """
        # Semantic search
        semantic_results = await super().retrieve(
            query, top_k=top_k * 2, threshold=threshold, rerank=False
        )
        
        # Keyword search
        keyword_results = self._keyword_search(query, top_k=top_k * 2)
        
        # Merge results with weighted scoring
        result_map = {}
        
        for r in semantic_results:
            result_map[r.id] = RetrievalResult(
                id=r.id,
                content=r.content,
                score=r.score * semantic_weight,
                metadata=r.metadata
            )
        
        for r in keyword_results:
            if r.id in result_map:
                result_map[r.id].score += r.score * (1 - semantic_weight)
            else:
                result_map[r.id] = RetrievalResult(
                    id=r.id,
                    content=r.content,
                    score=r.score * (1 - semantic_weight),
                    metadata=r.metadata
                )
        
        # Sort and return
        results = sorted(result_map.values(), key=lambda x: x.score, reverse=True)
        return results[:top_k]
    
    def _keyword_search(self, query: str, top_k: int) -> List[RetrievalResult]:
        """Simple BM25-style keyword search."""
        query_words = set(query.lower().split())
        scores = []
        
        for i, chunk in enumerate(self.chunks):
            content = chunk.get("content", "").lower()
            content_words = set(content.split())
            
            # Count matches
            matches = len(query_words & content_words)
            if matches > 0:
                # Simple TF scoring
                score = matches / len(query_words)
                scores.append((i, score))
        
        # Sort and get top results
        scores.sort(key=lambda x: x[1], reverse=True)
        
        results = []
        for idx, score in scores[:top_k]:
            chunk = self.chunks[idx]
            results.append(RetrievalResult(
                id=chunk.get("id", f"chunk_{idx}"),
                content=chunk.get("content", ""),
                score=score,
                metadata=chunk.get("metadata", {})
            ))
        
        return results
