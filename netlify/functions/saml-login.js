// netlify/functions/saml-login.js
exports.handler = async () => {
  const kerberos = 'oconaill@mit.edu';
  const name = "Brian O'Conaill";
  const username = 'oconaill';

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Login Page</h1>
          <p>Your Kerberos is <b>${kerberos}</b></p>
          <p>Your name is <b>${name}</b></p>
          <p>Your username is <b>${username}</b></p>
          <p>This is a placeholder login page before real SAML integration.</p>
        </body>
      </html>
    `,
  };
};
