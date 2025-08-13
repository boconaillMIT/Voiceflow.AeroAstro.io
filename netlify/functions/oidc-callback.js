// netlify/functions/oidc-callback.js
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Only Post Method  Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { code, verifier } = payload;
  if (!code || !verifier) {
    return { statusCode: 400, body: 'Missing code or verifier' };
  }

  const clientId = process.env.OKTA_CLIENT_ID;
  const clientSecret = process.env.OKTA_CLIENT_SECRET; // stored securely in Netlify env
  const issuer = process.env.OKTA_ISSUER;
  const redirectUri = process.env.OKTA_REDIRECT_URI; // should be https://.../callback.html

  try {
    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

    // Use HTTP Basic auth if secret is present (safer than sending secret in body)
    if (clientSecret) {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers.Authorization = `Basic ${basic}`;
    } else {
      bodyParams.append('client_id', clientId);
    }

    const tokenRes = await fetch(`${issuer}/v1/token`, {
      method: 'POST',
      headers,
      body: bodyParams.toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      return { statusCode: 502, body: `Token exchange failed: ${text}` };
    }

    const tokens = await tokenRes.json();

    // decode id_token payload (simple base64 decode)
    const idToken = tokens.id_token;
    if (!idToken) return { statusCode: 502, body: 'No id_token returned' };

    const payloadPart = idToken.split('.')[1];
    const idTokenPayload = JSON.parse(Buffer.from(payloadPart, 'base64').toString('utf8'));

    return {
      statusCode: 200,
      body: JSON.stringify({
        name: idTokenPayload.name || '',
        email: idTokenPayload.email || '',
        kerberos: idTokenPayload.preferred_username || idTokenPayload.sub || '',
      }),
    };
  } catch (err) {
    console.error('Callback error', err);
    return { statusCode: 500, body: `Callback error: ${err.message}` };
  }
};
