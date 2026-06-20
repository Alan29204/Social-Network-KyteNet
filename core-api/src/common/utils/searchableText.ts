export function normalizePostHashtags(
  hashtags?: string[] | string | null,
): string[] {
  if (!hashtags) return [];
  if (Array.isArray(hashtags)) {
    return hashtags
      .map((tag) => String(tag).replace(/^#/, '').trim())
      .filter(Boolean);
  }
  return hashtags
    .split(',')
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter(Boolean);
}

export function extractHashtagsFromContent(content?: string | null): string[] {
  if (!content) return [];
  const matches = content.match(/#[\p{L}0-9_]+/gu) || [];
  return [...new Set(matches.map((tag) => tag.slice(1).trim()).filter(Boolean))];
}

export function splitHashtagWords(tag: string): string {
  return tag
    .trim()
    .replace(/^#/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPostSearchableText(
  content?: string | null,
  hashtags?: string[] | string | null,
): string {
  const parts: string[] = [];

  if (content?.trim()) {
    parts.push(content.trim());
  }

  for (const rawTag of normalizePostHashtags(hashtags)) {
    const tag = rawTag.replace(/^#/, '').trim();
    if (!tag) continue;

    parts.push(tag);
    parts.push(`#${tag}`);

    const splitTag = splitHashtagWords(tag);
    if (splitTag && splitTag.toLowerCase() !== tag.toLowerCase()) {
      parts.push(splitTag);
    }
  }

  const seen = new Set<string>();
  return parts
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(' ')
    .trim();
}

export function buildHashtagSearchTerms(query: string): string[] {
  const clean = query.replace(/^#/, '').trim().toLowerCase();
  if (!clean) return [];

  const compact = clean.replace(/\s+/g, '');
  return [...new Set([clean, compact].filter(Boolean))];
}
