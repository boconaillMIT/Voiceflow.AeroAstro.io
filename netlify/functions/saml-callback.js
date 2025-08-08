// netlify/functions/saml-callback.js
const { parseStringPromise } = require('xml2js');
const jwt = require('jsonwebtoken'); // Optional: if you want to create your own tokens

exports.handler = async (event) => {
  const body = event.body;

  // The SAMLResponse is base64 encoded XML in the POST body (URL-encoded form)
  const samlResponse = decodeURIComponent(body.match(/SAMLResponse=([^&]*)/)[1]);
  const samlXml = Buffer.from(samlResponse, 'base64').toString('utf8');

  // Here you would validate the SAML XML signature and verify conditions.
  // This is complex, so usually done with a SAML library.
  // For brevity, this example just parses the XML and extracts attributes.

  const parsed = await parseStringPromise(samlXml);

  // Extract attributes example (depends on your SAML setup)
  const attributes =
    parsed['samlp:Response']['Assertion'][0]['AttributeStatement'][0]['Attribute'];

  // Find Kerberos ID and email (attribute names depend on IdP)
  let kerberosId, email, name;

  attributes.forEach((attr) => {
    const attrName = attr.$.Name;
    const attrValue = attr.AttributeValue[0];
    if (attrName.includes('kerberos')) kerberosId = attrValue;
    if (attrName.includes('email')) email = attrValue;
    if (attrName.includes('name')) name = attrValue;
  });

  // For demonstration, just redirect back to chatbot with user info in query params
  const redirectUrl = `/chatbot.html?kerberos=${encodeURIComponent(kerberosId)}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;

  return {
    statusCode: 302,
    headers: {
      Location: redirectUrl,
      'Set-Cookie': `kerberos=${kerberosId}; Path=/; HttpOnly; Secure`,
    },
  };
};
