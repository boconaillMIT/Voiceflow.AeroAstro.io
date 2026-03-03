const QB_REALM    = 'mit.quickbase.com';
const QB_TABLE    = 'bvi4py32v';
const QB_FIELD_ID = 3;
const QB_EMBED_ID = 36;
const QB_QUEST_ID = 26;
const EMBED_MODEL = 'text-embedding-3-small';

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return respond(405, { success: false, error: 'Method not allowed' });
  }

  let question;
  try {
    const body = JSON.parse(event.body);
    question = body.question;
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

    let bestScore = -1, bestRecordId = null, bestQuestion = null;

    for (const record of records) {
      const embeddingRaw = record[QB_EMBED_ID]?.value;
      if (!embeddingRaw) continue;
      const vector = typeof embeddingRaw === 'string'
        ? embeddingRaw.split(',').map(Number)
        : embeddingRaw;
      const score = cosineSimilarity(queryEmbedding, vector);
      if (score > bestScore) {
        bestScore = score;
        bestRecordId = record[QB_FIELD_ID]?.value;
        bestQuestion = record[QB_QUEST_ID]?.value || null;
      }
    }

    if (bestRecordId === null) {
      return respond(200, { success: false, error: 'No similarity match found' });
    }

    return respond(200, {
      success: true,
      record_id: bestRecordId,
      score: Math.round(bestScore * 10000) / 10000,
      matched_question: bestQuestion
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
  c
