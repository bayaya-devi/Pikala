const EVENT_PATTERN = /^(?:auth\.(?:signup|login)\.(?:success|failure)|ride\.(?:start|end)|incident\.created|support\.created|payment\.updated|admin\.action|api\.error)$/;
const SAFE_FIELDS = new Set(['requestId', 'userId', 'resourceType', 'resourceId', 'outcome', 'code', 'status', 'provider', 'action', 'durationMs']);

function safeValue(value) {
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value === null || value === undefined) return undefined;
  return String(value).slice(0, 160);
}

export function logEvent(event, fields = {}, severity = 'info') {
  if (!EVENT_PATTERN.test(event)) return;
  const entry = { event, timestamp: new Date().toISOString() };
  for (const [key, value] of Object.entries(fields)) {
    if (!SAFE_FIELDS.has(key)) continue;
    const sanitized = safeValue(value);
    if (sanitized !== undefined) entry[key] = sanitized;
  }
  const method = severity === 'error' ? 'error' : severity === 'warn' ? 'warn' : 'log';
  console[method](JSON.stringify(entry));
}
