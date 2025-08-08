// netlify/functions/oidc-login.js
exports.handler = async (event) => {
  const clientId = process.env.OKTA_CLIENT_ID;
  const issuer = process.env.OKTA_ISSUER;
  const redirectUri = process.env.OKTA_REDIRECT_URI || 'https://aeroastrovfbot.netlify.app/.netlify/functions/oidc-callback';

  const authorizationEndpoint = `${issuer}/v1/authorize`;

  // Build the query params for the authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'openid profile email',
    redirect_uri: redirectUri,
    state: Math.random().toString(36).substring(2), // random state for CSRF protection
    nonce: Math.random().toString(36).substring(2), // random nonce for ID token validation
  });

  return {
    statusCode: 302,
    headers: {
      Location: `${authorizationEndpoint}?${params.toString()}`,
    },
  };
};
