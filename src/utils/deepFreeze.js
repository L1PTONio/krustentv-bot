/**
 * Rekursiv einfrieren eines Objekts/Arrays.
 * @param {unknown} value
 * @returns {unknown}
 */
export function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(v => deepFreeze(v));
  }
  return value;
}
