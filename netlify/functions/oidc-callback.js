// netlify/functions/oidc-callback.js - Fixed routing logic
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event) => {
  // FIXED: More specific check for validation vs OAuth callback
  // Check the actual request body content, not just existence
  let isValidationRequest = false;
  
  if (event.httpMethod === 'POST' && event.body) {
    try {
      const body = JSON.parse(event.body);
      // Validation requests have kerberosId, OAuth callbacks have code/verifier
      isValidationRequest = body.kerberosId !== undefined;
    } catch (e) {
      // If body parsing fails, it's not a valid request of either type
      console.error('Failed to parse request body');
    }
  }
  
  // Also check if the path explicitly includes validate-user
  if (event.path?.includes('validate-user') || isValidationRequest) {
    return handleValidation(event);
  }
  
  // Otherwise, handle OAuth callback
  return handleOAuthCallback(event);
};

// NEW: Handle validation requests from chatbot
async function handleValidation(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { kerberosId, department } = JSON.parse(event.body);
    
    console.log('🔐 Validating user:', kerberosId);
    
    // Call Make.com from server-side (no duplication)
    const response = await fetch('https://hook.us2.make.com/9c74dhseqfvnj6488gtx8mg4ho8hek3y', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kerberosId,
        department
      })
    });

    if (!response.ok) {
      throw new Error(`Make.com returned ${response.status}`);
    }

    const result = await response.json();
    
    console.log('✅ Validation successful:', result);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('❌ Validation error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Validation failed',
        message: error.message 
      })
    };
  }
}

// EXISTING: Handle OAuth callback
async function handleOAuthCallback(event) {
  let code, verifier;
  
  try {
    console.log('🚀 === OIDC CALLBACK DIAGNOSTIC START ===');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('🌐 HTTP Method:', event.httpMethod);
    
    // Handle both POST and GET requests
    if (event.httpMethod === 'POST') {
      console.log('📨 Processing POST request');
      try {
        const body = JSON.parse(event.body);
        console.log('📦 POST Body parsed successfully');
        console.log('📋 Body keys:', Object.keys(body));
        code = body.code;
        verifier = body.verifier;
      } catch (e) {
        console.error('❌ Error parsing POST body:', e.message);
        return {
          statusCode: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            error: 'Invalid JSON body',
            diagnostic: 'POST body parsing failed'
          })
        };
      }
    } else if (event.httpMethod === 'GET') {
      console.log('📨 Processing GET request');
      const params = event.queryStringParameters || {};
      code = params.code;
      verifier = params.verifier || event.headers['x-pkce-verifier'];
    } else {
      console.log('❌ Unsupported HTTP method:', event.httpMethod);
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    // Validate required parameters
    if (!code) {
      console.error('❌ Missing authorization code');
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing authorization code',
          diagnostic: 'No code parameter received'
        })
      };
    }
    
    if (!verifier) {
      console.error('❌ Missing PKCE verifier');
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing PKCE verifier',
          diagnostic: 'No verifier parameter received'
        })
      };
    }

    console.log('✅ Parameter validation passed');

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

    if (clientSecret) {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers.Authorization = `Basic ${basic}`;
    } else {
      bodyParams.append('client_id', clientId);
    }

    const tokenUrl = `${issuer}/v1/token`;

    // Exchange authorization code for tokens
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers,
      body: bodyParams.toString(),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('❌ Token exchange failed:', errorText);
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: `Token exchange failed: ${errorText}`
        })
      };
    }

    const tokens = await tokenRes.json();
    const idToken = tokens.id_token;

    if (!idToken) {
      console.error('❌ No id_token in response');
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'No id_token returned from Okta'
        })
      };
    }

    // Decode the ID token
    const tokenParts = idToken.split('.');
    if (tokenParts.length !== 3) {
      console.error('❌ Invalid JWT format');
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Invalid JWT format'
        })
      };
    }

    const payloadPart = tokenParts[1];
    const idTokenPayload = JSON.parse(
      Buffer.from(payloadPart, 'base64').toString('utf8')
    );

    // Extract and format user metadata
    const userMetadata = {
      name: idTokenPayload.name || (idTokenPayload.given_name && idTokenPayload.family_name ? 
        idTokenPayload.given_name + ' ' + idTokenPayload.family_name : ''),
      email: idTokenPayload.email || '',
      kerberos: (idTokenPayload.preferred_username || idTokenPayload.sub || '').replace('@mit.edu', ''),
      firstName: idTokenPayload.given_name || '',
      lastName: idTokenPayload.family_name || '',
      groups: idTokenPayload.groups || [],
      department: idTokenPayload.department || '',
      title: idTokenPayload.title || '',
      loginTime: new Date().toISOString(),
      raw: idTokenPayload
    };

    console.log('✅ User metadata processed');
    console.log('🎉 === OIDC CALLBACK DIAGNOSTIC END ===');

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(userMetadata)
    };

  } catch (err) {
    console.error('💥 === FATAL ERROR IN OIDC CALLBACK ===');
    console.error('❌ Error message:', err.message);
    console.error('📚 Error stack:', err.stack);
    
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: err.message
      })
    };
  }
}
