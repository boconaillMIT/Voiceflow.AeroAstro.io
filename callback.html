<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Callback - AeroAstro Chatbot</title>
</head>
<body>
  <h2>Logging in...</h2>
  <script>
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const verifier = localStorage.getItem('pkce_verifier');

      if (!code || !verifier) {
        document.body.innerHTML = '<p>Error: missing code or PKCE verifier.</p>';
        return;
      }

      try {
        const res = await fetch('/.netlify/functions/oidc-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, verifier })
        });

        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        const user = await res.json();

        // Save user info for chatbot
        localStorage.setItem('user_name', user.name);
        localStorage.setItem('user_email', user.email);
        localStorage.setItem('user_kerberos', user.kerberos);

        // Redirect to Voiceflow chatbot
        window.location.href = 'chatbot.html';
      } catch (err) {
        document.body.innerHTML = `<p>Login failed: ${err.message}</p>`;
      }
    }

    handleCallback();
  </script>
</body>
</html>
