// netlify/functions/saml-login.js
exports.handler = async (event) => {
  // Replace this with your actual IdP SSO URL from Okta/MIT
  const idpSsoUrl = process.env.IDP_SSO_URL;

  return {
    statusCode: 302,
    headers: {
      Location: idpSsoUrl,
    },
  };
};
