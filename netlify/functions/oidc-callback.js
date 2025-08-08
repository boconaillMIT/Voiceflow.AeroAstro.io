const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { code, verifier } = JSON.parse(event.body);
  const clientId = process.env.OKTA_CLIENT_ID;
  const issuer = process.env.OKTA_ISSUER;
  const redirectUri = process.env.OKTA_REDIRECT_URI;

  if (!code || !verifier) {
    return { statusCode: 400, body: 'Missing code or verifier' };
  }

  try {
    const tokenResponse = await fetch(`${issuer}/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return { statusCode: 500, body: `Token exchange failed: ${errorText}` };
    }

    const tokens = await tokenResponse.json();

    const idTokenPayload = JSON.parse(
      Buffer.from(tokens.id_token.split('.')[1], 'base64').toString('utf-8')
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        name: idTokenPayload.name || '',
        email: idTokenPayload.email || '',
        username: idTokenPayload.preferred_username || '',
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: `Callback error: ${err.message}` };
  }
};
