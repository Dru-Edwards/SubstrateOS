"""
Document Ingestion Pipeline for RAG.

Processes documents, chunks them, generates embeddings, and stores in vector DB.
"""

import argparse
import hashlib
import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

import numpy as np
import structlog

from rag.chunking import get_chunker, Chunk
from rag.embed import get_embedding_model

logger = structlog.get_logger()


def ingest_file(
    file_path: Path,
    chunker,
    file_type: str = "auto"
) -> List[Chunk]:
    """
    Ingest a single file and return chunks.
    """
    if file_type == "auto":
        suffix = file_path.suffix.lower()
        if suffix in [".md", ".txt", ".rst"]:
            file_type = "text"
        elif suffix in [".py", ".ts", ".js", ".tsx", ".jsx"]:
            file_type = "code"
        elif suffix == ".json":
            file_type = "json"
        else:
            file_type = "text"
    
    try:
        with open(file_path, encoding="utf-8") as f:
            content = f.read()
    except UnicodeDecodeError:
        logger.warning("Skipping binary file", path=str(file_path))
        return []
    
    if not content.strip():
        return []
    
    # Generate document ID from path
    doc_id = hashlib.md5(str(file_path).encode()).hexdigest()[:12]
    
    metadata = {
        "source": str(file_path),
        "file_type": file_type,
        "size": len(content),
        "ingested_at": datetime.utcnow().isoformat()
    }
    
    return chunker.chunk(content, doc_id, metadata)


def ingest_directory(
    dir_path: Path,
    chunker,
    extensions: List[str] = None,
    exclude_patterns: List[str] = None
) -> List[Chunk]:
    """
    Recursively ingest all files in a directory.
    """
    extensions = extensions or [".md", ".txt", ".py", ".ts", ".js", ".tsx", ".rst"]
    exclude_patterns = exclude_patterns or ["node_modules", "__pycache__", ".git", "dist"]
    
    all_chunks = []
    
    for file_path in dir_path.rglob("*"):
        # Skip excluded patterns
        if any(pattern in str(file_path) for pattern in exclude_patterns):
            continue
        
        # Check extension
        if file_path.suffix.lower() not in extensions:
            continue
        
        if file_path.is_file():
            chunks = ingest_file(file_path, chunker)
            all_chunks.extend(chunks)
            logger.debug("Ingested file", path=str(file_path), chunks=len(chunks))
    
    return all_chunks


async def ingest_documents(
    source: str,
    chunk_size: int = 512,
    chunk_overlap: int = 50,
    output_path: str = "./data/vectors"
) -> Dict[str, Any]:
    """
    Main ingestion pipeline.
    
    1. Load documents from source
    2. Chunk documents
    3. Generate embeddings
    4. Store in vector database
    """
    import faiss
    
    source_path = Path(source)
    output_path = Path(output_path)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Get chunker
    chunker = get_chunker("semantic", max_chunk_size=chunk_size)
    
    # Ingest documents
    logger.info("Starting document ingestion", source=source)
    
    if source_path.is_file():
        chunks = ingest_file(source_path, chunker)
    else:
        chunks = ingest_directory(source_path, chunker)
    
    if not chunks:
        return {
            "documents": 0,
            "chunks": 0,
            "errors": ["No documents found"]
        }
    
    logger.info("Documents chunked", total_chunks=len(chunks))
    
    # Generate embeddings
    embedding_model = get_embedding_model(
        os.getenv("EMBEDDING_MODEL_TYPE", "openai"),
        model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    )
    
    texts = [c.content for c in chunks]
    embeddings = embedding_model.embed(texts)
    
    logger.info(
        "Embeddings generated",
        dimensions=embeddings.shape[1]
    )
    
    # Create FAISS index
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings.astype('float32'))
    
    # Save index
    faiss.write_index(index, str(output_path / "index.faiss"))
    
    # Save chunk metadata
    chunk_data = [
        {
            "id": c.id,
            "content": c.content,
            "metadata": c.metadata
        }
        for c in chunks
    ]
    
    with open(output_path / "chunks.json", "w") as f:
        json.dump(chunk_data, f)
    
    # Save ingestion metadata
    metadata = {
        "ingested_at": datetime.utcnow().isoformat(),
        "source": source,
        "chunk_size": chunk_size,
        "chunk_overlap": chunk_overlap,
        "total_chunks": len(chunks),
        "embedding_model": os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"),
        "dimensions": dimension
    }
    
    with open(output_path / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    
    logger.info("Ingestion complete", output=str(output_path))
    
    return {
        "documents": len(set(c.metadata.get("source") for c in chunks)),
        "chunks": len(chunks),
        "errors": []
    }


if __name__ == "__main__":
    import asyncio
    
    parser = argparse.ArgumentParser(description="Ingest documents for RAG")
    parser.add_argument("--corpus-path", "-c", required=True, help="Path to documents")
    parser.add_argument("--output", "-o", default="./data/vectors", help="Output path")
    parser.add_argument("--chunk-size", type=int, default=512)
    parser.add_argument("--chunk-overlap", type=int, default=50)
    
    args = parser.parse_args()
    
    result = asyncio.run(ingest_documents(
        source=args.corpus_path,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
        output_path=args.output
    ))
    
    print(f"Ingested {result['documents']} documents, {result['chunks']} chunks")
