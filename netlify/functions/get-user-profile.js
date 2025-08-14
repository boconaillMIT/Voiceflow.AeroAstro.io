// netlify/functions/get-user-profile.js
exports.handler = async (event) => {
  try {
    // Get kerberos from query parameters
    const kerberos = event.queryStringParameters?.kerberos;
    
    if (!kerberos) {
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
      // Add your test data here - replace with your actual info
      'your_kerberos': {
        name: 'Your Full Name',
        firstName: 'Your',
        lastName: 'Name', 
        title: 'Your Title',
        department: 'Your Department',
        email: 'your_kerberos@mit.edu'
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

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(userData)
    };

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
