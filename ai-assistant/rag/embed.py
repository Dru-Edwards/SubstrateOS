"""
Embedding generation for RAG pipeline.
"""

import os
from typing import List

import numpy as np
import structlog

logger = structlog.get_logger()


class EmbeddingModel:
    """Base class for embedding models."""
    
    def embed(self, texts: List[str]) -> np.ndarray:
        raise NotImplementedError
    
    @property
    def dimensions(self) -> int:
        raise NotImplementedError


class OpenAIEmbedding(EmbeddingModel):
    """OpenAI text-embedding models."""
    
    def __init__(self, model: str = "text-embedding-3-small"):
        self.model = model
        self._dimensions = {
            "text-embedding-3-small": 1536,
            "text-embedding-3-large": 3072,
            "text-embedding-ada-002": 1536
        }
        
        from openai import OpenAI
        self.client = OpenAI(api_key=os.getenv("LLM_API_KEY"))
    
    def embed(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for a list of texts."""
        # Batch in groups of 100
        all_embeddings = []
        batch_size = 100
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            
            response = self.client.embeddings.create(
                model=self.model,
                input=batch
            )
            
            embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(embeddings)
        
        return np.array(all_embeddings)
    
    @property
    def dimensions(self) -> int:
        return self._dimensions.get(self.model, 1536)


class SentenceTransformerEmbedding(EmbeddingModel):
    """Local sentence-transformers models."""
    
    def __init__(self, model: str = "all-MiniLM-L6-v2"):
        self.model_name = model
        from sentence_transformers import SentenceTransformer
        self.model = SentenceTransformer(model)
        self._dimensions = self.model.get_sentence_embedding_dimension()
    
    def embed(self, texts: List[str]) -> np.ndarray:
        return self.model.encode(texts, show_progress_bar=True)
    
    @property
    def dimensions(self) -> int:
        return self._dimensions


def get_embedding_model(model_type: str = "openai", **kwargs) -> EmbeddingModel:
    """Factory function to get embedding model."""
    if model_type == "openai":
        return OpenAIEmbedding(**kwargs)
    elif model_type == "sentence-transformers":
        return SentenceTransformerEmbedding(**kwargs)
    else:
        raise ValueError(f"Unknown embedding model type: {model_type}")
