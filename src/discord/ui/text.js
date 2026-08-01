import { MAX_EMBED_DESCRIPTION_LENGTH, MAX_CONTENT_LENGTH } from './limits.js';

export function truncate(text, maxLength = MAX_CONTENT_LENGTH) {
  if (typeof text !== 'string') {
    return '';
  }
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function safeDescription(text) {
  return truncate(text, MAX_EMBED_DESCRIPTION_LENGTH);
}

export function splitTextIntoPages(text, pageSize = 1000) {
  if (typeof text !== 'string' || text.length === 0) {
    return [''];
  }

  const chunks = [];
  for (let i = 0; i < text.length; i += pageSize) {
    chunks.push(text.slice(i, i + pageSize));
  }
  return chunks;
}
