// netlify/functions/get-user-profile.js
exports.handler = async (event) => {
  try {
    // DEBUG: Log the incoming request
    console.log('=== FUNCTION DEBUG ===');
    console.log('HTTP Method:', event.httpMethod);
    console.log('Query Parameters:', event.queryStringParameters);
    console.log('Headers:', event.headers);
    
    // Get kerberos from query parameters
    const kerberos = event.queryStringParameters?.kerberos;
    console.log('Extracted kerberos:', kerberos);
    
    if (!kerberos) {
      console.log('ERROR: Missing kerberos parameter');
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ error: 'Missing kerberos parameter' })
      };
    }

    // For now, we'll return mock data based on kerberos
    // You can enhance this later to pull from a database or LDAP
    const mockUserData = {
      // Add your real kerberos for testing
      'oconaill': {
        name: 'Brian O\'Conaill',
        firstName: 'Brian',
        lastName: 'O\'Conaill',
        title: 'Director of Administration and Finance',
        department: 'Department of Aeronautics and Astronautics',
        email: 'oconaill@mit.edu'
      },
      // Add other test users
      'jdoe': {
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        title: 'Professor',
        department: 'AeroAstro',
        email: 'jdoe@mit.edu'
      },
      'asmith': {
        name: 'Alice Smith', 
        firstName: 'Alice',
        lastName: 'Smith',
        title: 'Research Scientist',
        department: 'AeroAstro',
        email: 'asmith@mit.edu'
      }
    };

    // Get user data or return defaults
    const userData = mockUserData[kerberos] || {
      name: `${kerberos} (Unknown)`,
      firstName: kerberos,
      lastName: '',
      title: 'MIT User',
      department: 'Unknown Department',
      email: `${kerberos}@mit.edu`
    };

    console.log('Found user data:', userData);
    console.log('Returning response with status 200');

    const response = {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(userData)
    };

    console.log('Final response:', response);
    return response;

  } catch (error) {
    console.error('Error in get-user-profile:', error);
    
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};
