// netlify/functions/saml-callback.js
exports.handler = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "saml-callback function is live and reachable!",
      method: event.httpMethod,
      headers: event.headers,
      body: event.body
    }),
  };
};
