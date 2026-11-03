/**
 * Utility to sanitize user text inputs across nested objects and arrays.
 * Strips dangerous HTML tags and script injections while preserving
 * natural text characters (e.g. &, ', ", <, > in code/plain contexts).
 */

const cleanInput = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'string') return val;
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
};

function sanitizeObjectStrings(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = cleanInput(obj[key]);
    } else if (Array.isArray(obj[key])) {
      obj[key] = obj[key].map((item) =>
        typeof item === 'string'
          ? cleanInput(item)
          : typeof item === 'object' && item !== null
          ? sanitizeObjectStrings(item)
          : item
      );
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      obj[key] = sanitizeObjectStrings(obj[key]);
    }
  }
  return obj;
}

module.exports = sanitizeObjectStrings;
