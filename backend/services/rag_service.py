"""
RAG (Retrieval-Augmented Generation) service.

Loads plain-text documents from RAG_DOCS_DIR, builds a FAISS index
of sentence embeddings, and retrieves the top-k most relevant passages
for any query.
"""

import logging
import os
import hashlib
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

EMBED_MODEL = "all-MiniLM-L6-v2"   # fast, small, good quality
CHUNK_SIZE  = 400                   # characters per chunk
CHUNK_OVERLAP = 80


def _chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    chunks, start = [], 0
    while start < len(text):
        chunks.append(text[start : start + size])
        start += size - overlap
    return chunks


class RAGService:
    def __init__(self, docs_dir: str = "./rag_docs"):
        self.docs_dir   = Path(docs_dir)
        self._index     = None
        self._chunks:   list[str] = []
        self._model     = None
        self._docs_hash: Optional[str] = None

    def _load_embedder(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer(EMBED_MODEL)
                logger.info("RAG: embedder loaded (%s).", EMBED_MODEL)
            except ImportError:
                logger.warning("RAG: sentence-transformers not installed. RAG disabled.")

    def _docs_signature(self) -> str:
        """Hash of all doc file mtimes — used to detect changes."""
        sigs = []
        try:
            for p in sorted(self.docs_dir.glob("**/*.txt")):
                sigs.append(f"{p}:{p.stat().st_mtime}")
        except Exception:
            pass
        return hashlib.md5("|".join(sigs).encode()).hexdigest()

    def _build_index(self):
        try:
            import faiss
            import numpy as np
        except ImportError:
            logger.warning("RAG: faiss not installed. RAG disabled.")
            return

        try:
            self.docs_dir.mkdir(parents=True, exist_ok=True)
            txt_files = sorted(self.docs_dir.glob("**/*.txt"))
            if not txt_files:
                logger.warning("RAG: no .txt files found in %s.", self.docs_dir)
                return

            all_chunks = []
            for path in txt_files:
                text = path.read_text(encoding="utf-8", errors="ignore")
                all_chunks.extend(_chunk_text(text))

            if not all_chunks or self._model is None:
                return

            logger.info("RAG: embedding %d chunks from %d files …", len(all_chunks), len(txt_files))
            embeddings = self._model.encode(all_chunks, show_progress_bar=False, batch_size=64)
            embeddings = embeddings.astype("float32")

            dim   = embeddings.shape[1]
            index = faiss.IndexFlatIP(dim)
            faiss.normalize_L2(embeddings)
            index.add(embeddings)

            self._index      = index
            self._chunks     = all_chunks
            self._docs_hash  = self._docs_signature()
            logger.info("RAG: FAISS index built (%d vectors, dim=%d).", len(all_chunks), dim)
        except Exception as e:
            logger.warning("RAG index build failed: %s", e)

    def retrieve(self, query: str, top_k: int = 4) -> str:
        """
        Returns a string of the most relevant passages, ready to inject
        into an LLM prompt.  Returns empty string if RAG is unavailable.
        """
        try:
            import faiss
            import numpy as np
        except ImportError:
            return ""

        self._load_embedder()
        if self._model is None:
            return ""

        current_sig = self._docs_signature()
        if self._index is None or current_sig != self._docs_hash:
            self._build_index()

        if self._index is None or not self._chunks:
            return ""

        try:
            q_emb = self._model.encode([query], show_progress_bar=False).astype("float32")
            faiss.normalize_L2(q_emb)
            distances, indices = self._index.search(q_emb, top_k)

            passages = []
            for score, idx in zip(distances[0], indices[0]):
                if idx < 0 or score < 0.25:
                    continue
                passages.append(self._chunks[idx].strip())

            if not passages:
                return ""

            return "=== Relevant Knowledge ===\n" + "\n---\n".join(passages) + "\n=== End Knowledge ===\n"
        except Exception as e:
            logger.warning("RAG retrieve failed: %s", e)
            return ""
