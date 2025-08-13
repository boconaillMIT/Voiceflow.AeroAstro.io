// netlify/functions/oidc-callback.js
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event) => {
  // Handle GET request (Okta redirect)
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Get the code and PKCE verifier (verifier must be stored on client or in session)
    const params = event.queryStringParameters;
    const code = params.code;
    const verifier = params.verifier || event.headers['x-pkce-verifier']; // optional header fallback

    if (!code) {
      return { statusCode: 400, body: 'Missing authorization code' };
    }
    if (!verifier) {
      return { statusCode: 400, body: 'Missing PKCE verifier' };
    }

    const clientId = process.env.OKTA_CLIENT_ID;
    const clientSecret = process.env.OKTA_CLIENT_SECRET;
    const issuer = process.env.OKTA_ISSUER;
    const redirectUri = process.env.OKTA_REDIRECT_URI;

    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

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
    const idToken = tokens.id_token;
    if (!idToken) return { statusCode: 502, body: 'No id_token returned' };

    const payloadPart = idToken.split('.')[1];
    const idTokenPayload = JSON.parse(
      Buffer.from(payloadPart, 'base64').toString('utf8')
    );

    // Display metadata for debugging
    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          name: idTokenPayload.name || '',
          email: idTokenPayload.email || '',
          kerberos:
            idTokenPayload.preferred_username || idTokenPayload.sub || '',
          raw: idTokenPayload,
        },
        null,
        2
      ),
    };
  } catch (err) {
    console.error('Callback error', err);
    return { statusCode: 500, body: `Callback er
