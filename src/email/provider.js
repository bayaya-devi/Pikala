const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function unavailableProvider() {
  return { name: null, configured: false, async send() { return { ok: false, code: 'EMAIL_PROVIDER_UNAVAILABLE' }; } };
}

function resendProvider(env) {
  const configured = typeof env.RESEND_API_KEY === 'string' && env.RESEND_API_KEY.length >= 20
    && typeof env.FROM_EMAIL === 'string' && EMAIL_PATTERN.test(env.FROM_EMAIL);
  if (!configured) return unavailableProvider();
  return {
    name: 'resend', configured: true,
    async send({ to, subject, html }) {
      if (!EMAIL_PATTERN.test(String(to)) || !subject || !html) return { ok: false, code: 'EMAIL_INPUT_INVALID' };
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST', signal: AbortSignal.timeout(8000),
            headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
            body: JSON.stringify({ from: env.FROM_EMAIL, to, subject, html })
          });
          if (response.ok) return { ok: true };
          if (response.status !== 429 && response.status < 500) return { ok: false, code: 'EMAIL_PROVIDER_REJECTED' };
        } catch { /* One bounded retry handles transient network failures. */ }
      }
      return { ok: false, code: 'EMAIL_DELIVERY_FAILED' };
    }
  };
}

export function getEmailProvider(env) {
  if (env.EMAIL_DEV_MODE === '1') return { name: 'development', configured: true, async send() { return { ok: true, development: true }; } };
  return resendProvider(env);
}
