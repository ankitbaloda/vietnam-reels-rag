import re
from typing import Iterable, List

import tiktoken

def count_tokens(text: str, encoding_name: str = "cl100k_base") -> int:
    """Count tokens using tiktoken encoding."""
    if text is None:
        return 0
    encoding = tiktoken.get_encoding(encoding_name)
    return len(encoding.encode(text))

def split_paragraphs(text: str) -> List[str]:
    """Split text into paragraphs separated by blank lines."""
    parts = re.split(r"\n\s*\n+", text.strip())
    return [p.strip() for p in parts if p and p.strip()]

def split_sentences(paragraph: str) -> List[str]:
    """A simple sentence splitter that keeps punctuation.
    This is intentionally lightweight to avoid heavy dependencies.
    """
    paragraph = re.sub(r"\s+", " ", paragraph.strip())
    if not paragraph:
        return []
    sentences = re.split(r"(?<=[.!?])\s+", paragraph)
    return [s.strip() for s in sentences if s and s.strip()]

def window_sentences(
    sentences: List[str], max_tokens: int = 800, overlap_tokens: int = 100
) -> List[str]:
    """Create overlapping windows of sentences, approximately max_tokens in size.

    We accumulate sentences until we exceed max_tokens, then emit a chunk.
    Each subsequent chunk starts so that there are approximately overlap_tokens
    of token overlap with the previous chunk.
    """
    if not sentences:
        return []

    chunks: List[str] = []
    start = 0
    while start < len(sentences):
        current = []
        token_count = 0
        i = start
        while i < len(sentences):
            s = sentences[i]
            s_tokens = count_tokens(s)
            if current and token_count + s_tokens > max_tokens:
                break
            current.append(s)
            token_count += s_tokens
            i += 1
        if not current:  # single very long sentence
            current = [sentences[i]]
            i += 1
        chunks.append(" ".join(current))

        if i >= len(sentences):
            break
        back_tokens = 0
        j = len(current) - 1
        while j >= 0 and back_tokens < overlap_tokens:
            back_tokens += count_tokens(current[j])
            j -= 1
        start = start + max(j + 1, 1)

    return chunks

def hierarchical_chunks(
    text: str, max_tokens_per_chunk: int = 800, overlap_tokens: int = 100
) -> List[str]:
    """Two-level hierarchical chunking: paragraphs -> sentence windows."""
    chunks: List[str] = []
    for para in split_paragraphs(text):
        sents = split_sentences(para)
        chunks.extend(
            window_sentences(
                sents,
                max_tokens=max_tokens_per_chunk,
                overlap_tokens=overlap_tokens,
            )
        )
    return chunks
