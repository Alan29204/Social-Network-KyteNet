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
