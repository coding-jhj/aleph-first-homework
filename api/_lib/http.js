const MAX_BODY_BYTES = 1024 * 1024;

export function sendJson(res, status, payload, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  Object.entries(extraHeaders).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
}

export function sendNoContent(res, extraHeaders = {}) {
  res.statusCode = 204;
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  Object.entries(extraHeaders).forEach(([key, value]) => res.setHeader(key, value));
  res.end();
}

export function sendError(res, status, message, code = 'request_failed') {
  sendJson(res, status, { error: message, code });
}

export function methodNotAllowed(res, methods) {
  sendJson(res, 405, { error: '지원하지 않는 HTTP 메서드입니다.', code: 'method_not_allowed' }, {
    Allow: methods.join(', ')
  });
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string') {
    return parseJson(req.body);
  }
  if (Buffer.isBuffer(req.body)) {
    return parseJson(req.body.toString('utf8'));
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      throw new Error('request_body_too_large');
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return parseJson(Buffer.concat(chunks).toString('utf8'));
}

function parseJson(raw) {
  if (!raw || !raw.trim()) return {};
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('request_body_must_be_object');
    }
    return value;
  } catch {
    throw new Error('invalid_json');
  }
}

export function stringValue(value, maxLength = 256) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function isHttpMethod(req, method) {
  return (req.method || 'GET').toUpperCase() === method;
}

export function reportUnexpectedError(res, error) {
  const code = error && typeof error.message === 'string' ? error.message : 'unexpected_error';
  console.error('[t08]', code);
  sendError(res, 500, '서버 설정 또는 데이터베이스 연결을 확인해 주세요.', 'server_error');
}
