<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OIDC Callback</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Processing Login...</h1>
  <pre id="debug">Waiting for response...</pre>

  <script>
    (async () => {
      try {
        // 1️⃣ Get "code" from URL
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (!code) throw new Error("No 'code' parameter in URL");

        // 2️⃣ Get the PKCE verifier from localStorage
        const verifier = localStorage.getItem('pkce_verifier');
        if (!verifier) throw new Error("No PKCE verifier found in localStorage");

        // 3️⃣ POST to Netlify function
        const res = await fetch('/.netlify/functions/oidc-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, verifier })
        });

        if (!res.ok) {
          throw new Error(`Callback failed: ${await res.text()}`);
        }

        const metadata = await res.json();

        // 4️⃣ Save metadata in localStorage
        localStorage.setItem('user_metadata', JSON.stringify(metadata));

        // 5️⃣ Display for debugging
        document.getElementById('debug').textContent = JSON.stringify(metadata, null, 2);

        // 6️⃣ Initialize Voiceflow with metadata
        window.VoiceflowAssistant = window.VoiceflowAssistant || {};
        window.VoiceflowAssistant.init({
          versionID: "66df25f295ab4c2554ea24ad", // your VF Assistant ID
          user: {
            name: metadata.name || '',
            email: metadata.email || '',
            kerberos: metadata.kerberos || ''
          }
        });

      } catch (err) {
        document.getElementById('debug').textContent = `Error: ${err.message}`;
        console.error(err);
      }
    })();
  </script>

  <!-- Voiceflow Web Chat Script -->
  <script src="https://cdn.voiceflow.com/widget/bundle.mjs" type="module"></script>
</body>
</html>
