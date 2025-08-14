// netlify/functions/oidc-callback.js
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event) => {
  let code, verifier;
  
  // Handle both POST and GET requests
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body);
      code = body.code;
      verifier = body.verifier;
    } catch (e) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON body' })
      };
    }
  } else if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {};
    code = params.code;
    verifier = params.verifier || event.headers['x-pkce-verifier'];
  } else {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // Validate required parameters
  if (!code) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing authorization code' })
    };
  }
  
  if (!verifier) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing PKCE verifier' })
    };
  }

  try {
    // Get environment variables
    const clientId = process.env.OKTA_CLIENT_ID;
    const clientSecret = process.env.OKTA_CLIENT_SECRET;
    const issuer = process.env.OKTA_ISSUER;
    const redirectUri = process.env.OKTA_REDIRECT_URI;

    // Prepare token exchange request
    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

    // Handle client authentication (confidential vs public client)
    if (clientSecret) {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers.Authorization = `Basic ${basic}`;
    } else {
      bodyParams.append('client_id', clientId);
    }

    // Exchange authorization code for tokens
    const tokenRes = await fetch(`${issuer}/v1/token`, {
      method: 'POST',
      headers,
      body: bodyParams.toString(),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('Token exchange failed:', errorText);
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Token exchange failed: ${errorText}` })
      };
    }

    const tokens = await tokenRes.json();
    const idToken = tokens.id_token;

    if (!idToken) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No id_token returned from Okta' })
      };
    }

    // Decode the ID token to get user info
    const payloadPart = idToken.split('.')[1];
    const idTokenPayload = JSON.parse(
      Buffer.from(payloadPart, 'base64').toString('utf8')
    );

    // Extract and format user metadata
    const userMetadata = {
      name: idTokenPayload.name || idTokenPayload.given_name + ' ' + idTokenPayload.family_name || '',
      email: idTokenPayload.email || '',
      kerberos: (idTokenPayload.preferred_username || idTokenPayload.sub || '').replace('@mit.edu', ''), 
      firstName: idTokenPayload.given_name || '',
      lastName: idTokenPayload.family_name || '',
      groups: idTokenPayload.groups || [],
      department: idTokenPayload.department || '',
      title: idTokenPayload.title || '',
      // Add any other fields you want to pass to Voiceflow
      loginTime: new Date().toISOString(),
      raw: idTokenPayload // Keep full payload for debugging
    };

    // Return user metadata as JSON (for your callback page to consume)
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Allow CORS for your frontend
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(userMetadata)
    };

  } catch (err) {
    console.error('Callback error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: err.message 
      })
    };
  }
};
