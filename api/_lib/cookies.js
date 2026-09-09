function appendCookie(res, cookie) {
  const current = res.getHeader('Set-Cookie');
  const values = Array.isArray(current) ? current : current ? [current] : [];
  res.setHeader('Set-Cookie', [...values, cookie]);
}

function serializeCookie(name, value, options = {}) {
  const parts = [name + '=' + encodeURIComponent(value)];
  if (options.maxAge !== undefined) parts.push('Max-Age=' + options.maxAge);
  parts.push('Path=' + (options.path || '/'));
  parts.push('SameSite=' + (options.sameSite || 'Lax'));
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function readCookie(req, name) {
  const header = req.headers?.cookie || '';
  const pair = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(name + '='));
  if (!pair) return null;
  return decodeURIComponent(pair.slice(name.length + 1));
}

export function setCookie(res, name, value, options = {}) {
  appendCookie(res, serializeCookie(name, value, options));
}

export function clearCookie(res, name, options = {}) {
  setCookie(res, name, '', { ...options, maxAge: 0 });
}
