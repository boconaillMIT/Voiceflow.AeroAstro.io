const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event) => {
  const clientId = process.env.OKTA_CLIENT_ID;
  const issuer = process.env.OKTA_ISSUER;
  const redirectUri = process.env.OKTA_REDIRECT_URI;

  const params = new URLSearchParams(event.rawQuery || '');
  const code = params.get('code');
  const state = params.get('state');

  if (!code || !state) {
    return { statusCode: 400, body: 'Missing code or state parameters.' };
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch(`${issuer}/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: state, // assuming 'state' holds PKCE verifier
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return { statusCode: 500, body: `Token exchange failed: ${errorText}` };
    }

    const tokens = await tokenResponse.json();

    // Decode ID token payload (simple base64 decode)
    const idTokenPayload = JSON.parse(
      Buffer.from(tokens.id_token.split('.')[1], 'base64').toString('utf-8')
    );

    // Redirect to chatbot with user info in URL params
    const chatbotUrl = new URL('https://aeroastrovfbot.netlify.app/chatbot.html');
    chatbotUrl.searchParams.set('name', idTokenPayload.name || '');
    chatbotUrl.searchParams.set('email', idTokenPayload.email || '');
    chatbotUrl.searchParams.set('username', idTokenPayload.preferred_username || '');

    return {
      statusCode: 302,
      headers: { Location: chatbotUrl.toString() },
    };
  } catch (err) {
    return { statusCode: 500, body: `Callback error: ${err.message}` };
  }
};
