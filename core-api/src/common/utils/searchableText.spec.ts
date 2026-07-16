import {
  normalizePostHashtags,
  extractHashtagsFromContent,
} from './searchableText';

describe('normalizePostHashtags', () => {
  it('returns an empty array for null/undefined/empty input', () => {
    expect(normalizePostHashtags(null)).toEqual([]);
    expect(normalizePostHashtags(undefined)).toEqual([]);
    expect(normalizePostHashtags('')).toEqual([]);
  });

  it('strips leading #, trims and drops empty entries from an array', () => {
    expect(normalizePostHashtags(['#vn', ' travel ', '', '#nestjs'])).toEqual([
      'vn',
      'travel',
      'nestjs',
    ]);
  });

  it('splits a comma-separated string into clean tags', () => {
    expect(normalizePostHashtags('#a, b ,#c')).toEqual(['a', 'b', 'c']);
  });
});

describe('extractHashtagsFromContent', () => {
  it('returns an empty array when there is no content', () => {
    expect(extractHashtagsFromContent(null)).toEqual([]);
    expect(extractHashtagsFromContent('')).toEqual([]);
  });

  it('extracts unique hashtags from post content', () => {
    expect(
      extractHashtagsFromContent('Học #NestJS và #redis, nhắc lại #NestJS'),
    ).toEqual(['NestJS', 'redis']);
  });
});
