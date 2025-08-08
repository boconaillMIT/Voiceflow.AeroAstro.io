const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async (event) => {
  const clientId = process.env.OKTA_CLIENT_ID;
  const issuer = process.env.OKTA_ISSUER;
  const redirectUri = process.env.OKTA_REDIRECT_URI;

  const params = new URLSearchParams(event.rawQuery || '');
  const code = params.get('code');
  const state = params.get('state');
  const verifier = localStorage.getItem('pkce_verifier'); // Note: localStorage not available here, see note below

  if (!code || !state) {
    return { statusCode: 400, body: 'Missing code or state' };
  }

  // Since localStorage is client-side, you should pass the verifier via 'state' or another mechanism.

  try {
    const tokenResponse = await fetch(`${issuer}/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: state, // assuming state holds verifier here
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      return { statusCode: 500, body: `Token request failed: ${error}` };
    }

    const tokens = await tokenResponse.json();
    const idTokenPayload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());

    // Redirect user to chatbot with name/email from ID token
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
