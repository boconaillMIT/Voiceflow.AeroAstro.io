// netlify/functions/oidc-callback.js - Diagnostic Version
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event) => {
  let code, verifier;
  
  try {
    console.log('🚀 === OIDC CALLBACK DIAGNOSTIC START ===');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('🌐 HTTP Method:', event.httpMethod);
    console.log('🔗 Headers:', JSON.stringify(event.headers, null, 2));
    console.log('📍 Source IP:', event.headers['x-forwarded-for'] || 'unknown');
    console.log('🏢 User Agent:', event.headers['user-agent'] || 'unknown');
    
    // Handle both POST and GET requests
    if (event.httpMethod === 'POST') {
      console.log('📨 Processing POST request');
      try {
        const body = JSON.parse(event.body);
        console.log('📦 POST Body parsed successfully');
        console.log('📋 Body keys:', Object.keys(body));
        code = body.code;
        verifier = body.verifier;
        console.log('✅ Extracted from POST:', {
          codeLength: code ? code.length : 0,
          verifierLength: verifier ? verifier.length : 0,
          codePreview: code ? code.substring(0, 20) + '...' : 'MISSING',
          verifierPreview: verifier ? verifier.substring(0, 20) + '...' : 'MISSING'
        });
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
      console.log('📋 Query parameters:', JSON.stringify(params, null, 2));
      code = params.code;
      verifier = params.verifier || event.headers['x-pkce-verifier'];
      console.log('✅ Extracted from GET:', {
        codeLength: code ? code.length : 0,
        verifierLength: verifier ? verifier.length : 0
      });
    } else {
      console.log('❌ Unsupported HTTP method:', event.httpMethod);
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    // Validate required parameters
    console.log('🔍 Validating parameters...');
    const validation = {
      hasCode: !!code,
      hasVerifier: !!verifier,
      codeType: typeof code,
      verifierType: typeof verifier
    };
    console.log('📊 Validation results:', validation);
    
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
    console.log('🔧 Loading environment variables...');
    const clientId = process.env.OKTA_CLIENT_ID;
    const clientSecret = process.env.OKTA_CLIENT_SECRET;
    const issuer = process.env.OKTA_ISSUER;
    const redirectUri = process.env.OKTA_REDIRECT_URI;

    const envCheck = {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasIssuer: !!issuer,
      hasRedirectUri: !!redirectUri,
      clientIdLength: clientId ? clientId.length : 0,
      issuer: issuer,
      redirectUri: redirectUri
    };
    console.log('🔧 Environment variables check:', envCheck);

    // Prepare token exchange request
    console.log('🔄 Preparing token exchange...');
    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

    // Handle client authentication (confidential vs public client)
    if (clientSecret) {
      console.log('🔐 Using confidential client authentication');
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers.Authorization = `Basic ${basic}`;
    } else {
      console.log('🔓 Using public client authentication');
      bodyParams.append('client_id', clientId);
    }

    const tokenUrl = `${issuer}/v1/token`;
    console.log('🎯 Token endpoint:', tokenUrl);
    console.log('📤 Request headers:', Object.keys(headers));

    // Exchange authorization code for tokens
    console.log('🚀 Starting token exchange request...');
    const requestStart = Date.now();
    
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers,
      body: bodyParams.toString(),
    });

    const requestEnd = Date.now();
    const requestDuration = requestEnd - requestStart;
    
    console.log('📥 Token exchange response received');
    console.log('⏱️  Request duration:', requestDuration + 'ms');
    console.log('📊 Response status:', tokenRes.status, tokenRes.statusText);
    console.log('📋 Response headers:', Object.fromEntries(tokenRes.headers.entries()));

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('❌ Token exchange failed');
      console.error('📄 Error response:', errorText);
      console.error('📊 Error status:', tokenRes.status);
      
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: `Token exchange failed: ${errorText}`,
          diagnostic: {
            status: tokenRes.status,
            duration: requestDuration,
            endpoint: tokenUrl
          }
        })
      };
    }

    const tokens = await tokenRes.json();
    console.log('🎟️  Token response parsed');
    console.log('🔑 Token keys:', Object.keys(tokens));
    console.log('📏 Token sizes:', Object.fromEntries(
      Object.entries(tokens).map(([key, value]) => [
        key, 
        typeof value === 'string' ? value.length + ' chars' : typeof value
      ])
    ));

    const idToken = tokens.id_token;

    if (!idToken) {
      console.error('❌ No id_token in response');
      console.error('📄 Available tokens:', Object.keys(tokens));
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'No id_token returned from Okta',
          diagnostic: 'Token response missing id_token field'
        })
      };
    }

    console.log('🆔 ID token found, decoding...');

    // Decode the ID token to get user info
    const tokenParts = idToken.split('.');
    console.log('🧩 Token parts:', tokenParts.length);
    
    if (tokenParts.length !== 3) {
      console.error('❌ Invalid JWT format');
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Invalid JWT format',
          diagnostic: `Expected 3 parts, got ${tokenParts.length}`
        })
      };
    }

    const payloadPart = tokenParts[1];
    const idTokenPayload = JSON.parse(
      Buffer.from(payloadPart, 'base64').toString('utf8')
    );

    console.log('🔓 Token payload decoded');
    console.log('👤 Payload keys:', Object.keys(idTokenPayload));
    console.log('📋 Payload preview:', JSON.stringify({
      sub: idTokenPayload.sub,
      name: idTokenPayload.name,
      email: idTokenPayload.email,
      preferred_username: idTokenPayload.preferred_username,
      title: idTokenPayload.title,
      department: idTokenPayload.department,
      mit_id: idTokenPayload.mit_id
    }, null, 2));

    // Extract and format user metadata
    console.log('🔄 Processing user metadata...');
    
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
    console.log('👤 Final user data:', JSON.stringify({
      ...userMetadata,
      raw: '[HIDDEN - See above for full payload]'
    }, null, 2));

    // Prepare final response
    const response = {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(userMetadata)
    };

    console.log('📤 Sending successful response');
    console.log('📊 Response size:', response.body.length + ' chars');
    console.log('⏰ Total processing time:', (Date.now() - requestStart) + 'ms');
    console.log('🎉 === OIDC CALLBACK DIAGNOSTIC END ===');

    return response;

  } catch (err) {
    console.error('💥 === FATAL ERROR IN OIDC CALLBACK ===');
    console.error('❌ Error message:', err.message);
    console.error('📚 Error stack:', err.stack);
    console.error('🔍 Error details:', {
      name: err.name,
      code: err.code,
      type: typeof err,
      hasCode: !!code,
      hasVerifier: !!verifier
    });
    
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: err.message,
        diagnostic: 'Check function logs for detailed error information'
      })
    };
  }
};
