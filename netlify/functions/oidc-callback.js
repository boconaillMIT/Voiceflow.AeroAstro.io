// netlify/functions/oidc-callback.js

const fetch = require('node-fetch'); // make sure to add "node-fetch" in your package.json dependencies

exports.handler = async (event) => {
  const clientId = process.env.OKTA_CLIENT_ID;
  const clientSecret = process.env.OKTA_CLIENT_SECRET; // needed if using confidential client
  const issuer = process.env.OKTA_ISSUER;
  const redirectUri = process.env.OKTA_REDIRECT_URI || 'https://aeroastrovfbot.netlify.app/.netlify/functions/oidc-callback';

  // Parse query params
  const params = new URLSearchParams(event.rawQuery || '');
  const code = params.get('code');
  const state = params.get('state');

  if (!code) {
    return {
      statusCode: 400,
      body: 'Authorization code missing from callback',
    };
  }

  try {
    // Exchange code for tokens
    const tokenEndpoint = `${issuer}/v1/token`;
    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Basic Auth header if clientSecret is present
        ...(clientSecret && {
          Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        }),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return { statusCode: 500, body: `Token exchange failed: ${errorText}` };
    }

    const tokenData = await tokenResponse.json();

    // Decode ID token (JWT) to extract user info (simplified: not verifying here)
    const idToken = tokenData.id_token;
    const base64Payload = idToken.split('.')[1];
    const payloadJson = Buffer.from(base64Payload, 'base64').toString('utf-8');
    const userInfo = JSON.parse(payloadJson);

    // Redirect to chatbot with user info as query params (you can adjust this)
    const chatbotUrl = new URL('https://aeroastrovfbot.netlify.app/chatbot.html');
    chatbotUrl.searchParams.set('name', userInfo.name || '');
    chatbotUrl.searchParams.set('email', userInfo.email || '');
    chatbotUrl.searchParams.set('sub', userInfo.sub || '');

    return {
      statusCode: 302,
      headers: {
        Location: chatbotUrl.toString(),
      },
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: `Callback processing error: ${err.message}`,
    };
  }
};
