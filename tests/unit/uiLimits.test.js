import { describe, expect, it } from '@jest/globals';
import { MAX_EMBED_FIELDS, MAX_COMPONENT_ROWS, MAX_SELECT_OPTIONS, MAX_EMBED_DESCRIPTION_LENGTH, MAX_EMBED_TITLE_LENGTH, MAX_CONTENT_LENGTH } from '../../src/discord/ui/limits.js';
import { truncate, safeDescription, splitTextIntoPages } from '../../src/discord/ui/text.js';

describe('discord ui limits', () => {
  it('keeps payload limits within Discord bounds', () => {
    expect(MAX_EMBED_FIELDS).toBeLessThanOrEqual(25);
    expect(MAX_COMPONENT_ROWS).toBeLessThanOrEqual(5);
    expect(MAX_SELECT_OPTIONS).toBeLessThanOrEqual(25);
  });

  it('truncates text and splits it into pages safely', () => {
    const text = 'x'.repeat(500);
    expect(truncate(text, 20)).toHaveLength(20);
    const description = safeDescription(text);
    expect(description.length).toBeLessThanOrEqual(MAX_EMBED_DESCRIPTION_LENGTH);
    const pages = splitTextIntoPages('a\n'.repeat(50), 10);
    expect(pages.length).toBeGreaterThan(1);
  });

  it('respects content length limits', () => {
    expect(MAX_CONTENT_LENGTH).toBeGreaterThan(0);
  });
});
