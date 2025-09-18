// File: netlify/functions/validate-user.js
// This creates a CORS-enabled proxy to your Make.com webhook

exports.handler = async (event, context) => {
  // Set CORS headers for all responses
  const headers = {
    'Access-Control-Allow-Origin': '*', // or specify your domain: 'https://aeroastrovfbot.netlify.app'
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed - POST only' })
    };
  }

  try {
    console.log('Proxy: Processing validation request');
    
    // Parse the request body
    const requestBody = JSON.parse(event.body);
    const { kerberosId, department } = requestBody;

    console.log('Proxy: Forwarding to Make.com for user:', kerberosId);

    // Forward the exact same request to Make.com (unchanged)
    const makeResponse = await fetch('https://hook.us2.make.com/nsevfwoyexfveb4goqoxk4eta2sadle2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kerberosId,
        department
      })
    });

    if (!makeResponse.ok) {
      throw new Error(`Make.com responded with status: ${makeResponse.status}`);
    }

    const makeData = await makeResponse.json();
    console.log('Proxy: Got response from Make.com:', makeData);

    // Return the Make.com response with CORS headers
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(makeData)
    };

  } catch (error) {
    console.error('Proxy error:', error);
    
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Proxy error',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
