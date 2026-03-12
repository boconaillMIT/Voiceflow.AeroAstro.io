const QB_REALM = 'mit.quickbase.com';
const QB_TABLE = 'bvi4py32v';
const QB_FIELD_ID = 3;
const QB_EMBED_FIELD = 36;
const EMBED_MODEL = 'text-embedding-3-small';

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return respond(405, { success: false, error: 'Method not allowed' });
  }

  let record_id, question;
  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;
    const body = JSON.parse(rawBody);
    record_id = body.record_id;
    question = body.question;
    if (!record_id) throw new Error('Missing record_id');
    if (!question) throw new Error('Missing question');
  } catch (e) {
    return respond(400, { success: false, error: 'Invalid body: ' + e.message });
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  const QB_TOKEN = process.env.QB_TOKEN;
  if (!OPENAI_KEY || !QB_TOKEN) {
    return respond(500, { success: false, error: 'Missing env vars' });
  }

  try {
    // Step 1: Generate embedding from OpenAI
    const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: question })
    });

    if (!embeddingRes.ok) {
      throw new Error('OpenAI error: ' + await embeddingRes.text());
    }

    const embeddingData = await embeddingRes.json();
    const embedding = embeddingData.data[0].embedding;

    // Step 2: Convert embedding array to comma-separated string for QB storage
    const embeddingString = embedding.join(',');

    // Step 3: Write embedding back to QuickBase field 36
    const qbRes = await fetch('https://api.quickbase.com/v1/records', {
      method: 'POST',
      headers: {
        'QB-Realm-Hostname': QB_REALM,
        'Authorization': `QB-USER-TOKEN ${QB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: QB_TABLE,
        data: [
          {
            [QB_FIELD_ID]: { value: record_id },
            [QB_EMBED_FIELD]: { value: embeddingString }
          }
        ],
        fieldsToReturn: [QB_FIELD_ID]
      })
    });

    if (!qbRes.ok) {
      throw new Error('QuickBase error: ' + await qbRes.text());
    }

    return respond(200, {
      success: true,
      record_id: record_id,
      embedding_length: embedding.length
    });

  } catch (err) {
    return respond(500, { success: false, error: err.message });
  }
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
