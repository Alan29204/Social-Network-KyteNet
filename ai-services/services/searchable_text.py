import re
from typing import Iterable, Optional


def _as_hashtag_list(hashtags) -> list[str]:
    if not hashtags:
        return []
    if isinstance(hashtags, str):
        value = hashtags.strip()
        if value.startswith("{") and value.endswith("}"):
            value = value[1:-1]
        return [item.strip().strip('"').strip("'") for item in value.split(",") if item.strip()]
    if isinstance(hashtags, Iterable):
        return [str(item).strip().lstrip("#") for item in hashtags if str(item).strip()]
    return []


def split_hashtag_words(tag: str) -> str:
    clean = tag.strip().lstrip("#")
    clean = re.sub(r"[_\-]+", " ", clean)
    clean = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", clean)
    clean = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", clean)
    return re.sub(r"\s+", " ", clean).strip()


def build_searchable_text(content: Optional[str] = None, hashtags=None) -> str:
    parts: list[str] = []
    if content and content.strip():
        parts.append(content.strip())

    for raw_tag in _as_hashtag_list(hashtags):
        tag = raw_tag.strip().lstrip("#")
        if not tag:
            continue
        parts.append(tag)
        parts.append(f"#{tag}")
        split_tag = split_hashtag_words(tag)
        if split_tag and split_tag.lower() != tag.lower():
            parts.append(split_tag)

    seen = set()
    unique_parts = []
    for part in parts:
        key = part.lower()
        if key not in seen:
            seen.add(key)
            unique_parts.append(part)

    return " ".join(unique_parts).strip()
