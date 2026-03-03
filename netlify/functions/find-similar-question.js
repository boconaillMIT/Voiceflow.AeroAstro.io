const QB_REALM    = 'mit.quickbase.com';
const QB_TABLE    = 'bvi4py32v';
const QB_FIELD_ID = 3;
const QB_EMBED_ID = 36;
const QB_QUEST_ID = 26;
const QB_ANS_ID   = 22;
const EMBED_MODEL = 'text-embedding-3-small';

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return respond(405, { success: false, error: 'Method not allowed' });
  }

  let question;
  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;
    const body = JSON.parse(rawBody);
    question = body.question;
    //if (!question) throw new Error('Missing question');
    
    // ADD THESE DEBUG LINES:
    console.error('=== NETLIFY DEBUG ===');
    console.error('Raw event.body:', event.body);
    console.error('Parsed question:', question);
    console.error('Question length:', question.length);
    console.error('Full parsed body:', JSON.stringify(body));
    if (!question) throw new Error('Missing question');
  } catch (e) {
    return respond(400, { success: false, error: 'Invalid body: ' + e.message });
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  const QB_TOKEN   = process.env.QB_TOKEN;
  if (!OPENAI_KEY || !QB_TOKEN) {
    return respond(500, { success: false, error: 'Missing env vars' });
  }

  try {
    const queryEmbedding = await getEmbedding(question, OPENAI_KEY);
    const records = await fetchQBRecords(QB_TOKEN);
    if (!records || records.length === 0) {
      return respond(200, { success: false, error: 'No QB records found' });
    }

    let bestScore = -1, bestRecord = null;

    for (const record of records) {
      const embeddingRaw = record[QB_EMBED_ID]?.value;
      if (!embeddingRaw) continue;
      const vector = typeof embeddingRaw === 'string'
        ? embeddingRaw.split(',').map(Number)
        : embeddingRaw;
      const score = cosineSimilarity(queryEmbedding, vector);
      if (score > bestScore) {
        bestScore = score;
        bestRecord = record;
      }
    }

    if (!bestRecord) {
      return respond(200, { success: false, error: 'No similarity match found' });
    }

    // Decode base64 answer
    const answer = bestRecord[QB_ANS_ID]?.value || '';
    const answerDecoded = Buffer.from(answer, 'base64').toString('utf-8');
    console.log('=== NETLIFY DEBUG ===');
    console.log('Raw event.body:', event.body);
    console.log('Parsed question:', question);
    console.log('Question length:', question.length);
    return respond(200, {
      success: true,
      record_id: bestRecord[QB_FIELD_ID]?.value,
      score: Math.round(bestScore * 10000) / 10000,
      matched_question: bestRecord[QB_QUEST_ID]?.value || null,
      answer: answer,
      answer_decoded: answerDecoded
    });

  } catch (err) {
    return respond(500, { success: false, error: err.message });
  }
};

async function getEmbedding(text, apiKey) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: text })
  });
  if (!res.ok) throw new Error('OpenAI error: ' + await res.text());
  const data = await res.json();
  return data.data[0].embedding;
}

async function fetchQBRecords(token) {
  const res = await fetch('https://api.quickbase.com/v1/records/query', {
    method: 'POST',
    headers: {
      'QB-Realm-Hostname': QB_REALM,
      'Authorization': `QB-USER-TOKEN ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: QB_TABLE, select: [QB_FIELD_ID, QB_EMBED_ID, QB_QUEST_ID, QB_ANS_ID] })
  });
  if (!res.ok) throw new Error('QuickBase error: ' + await res.text());
  return (await res.json()).data;
}

function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i];
  }
  return (normA === 0 || normB === 0) ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function respond(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
