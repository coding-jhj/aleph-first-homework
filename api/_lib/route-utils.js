export function queryValue(req, key) {
  const value = req.query?.[key];
  if (Array.isArray(value)) return value[0] || '';
  if (typeof value === 'string') return value;

  const url = new URL(req.url || '/', 'http://localhost');
  const segments = url.pathname.split('/').filter(Boolean);
  if (key === 'passkeyId') {
    const index = segments.indexOf('passkeys');
    return index >= 0 ? decodeURIComponent(segments[index + 1] || '') : '';
  }
  if (key === 'accountId') {
    const index = segments.indexOf('accounts');
    return index >= 0 ? decodeURIComponent(segments[index + 1] || '') : '';
  }
  return '';
}
