const QB_REALM = 'mit.quickbase.com';
const QB_TABLE = 'bvi4py32v';
const QB_FIELD_ID = 3;
const QB_VARIANTS_FIELD = 37;
const EMBED_MODEL = 'text-embedding-3-small';

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return respond(405, { success: false, error: 'Method not allowed' });
  }

  let record_id, new_variant, create_record;
  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;
    const body = JSON.parse(rawBody);
    record_id = body.record_id;
    new_variant = body.new_variant;
    create_record = body.create_record === true || body.create_record === 'true';

    if (!record_id) throw new Error('Missing record_id');
    if (!new_variant) throw new Error('Missing new_variant');
  } catch (e) {
    return respond(400, { success: false, error: 'Invalid body: ' + e.message });
  }

  const QB_TOKEN = process.env.QB_TOKEN;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!QB_TOKEN) {
    return respond(500, { success: false, error: 'Missing QB_TOKEN env var' });
  }

  try {
    // Step 1: GET current variants value
    const getRes = await fetch('https://api.quickbase.com/v1/records/query', {
      method: 'POST',
      headers: {
        'QB-Realm-Hostname': QB_REALM,
        'Authorization': `QB-USER-TOKEN ${QB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: QB_TABLE,
        select: [QB_FIELD_ID, QB_VARIANTS_FIELD, 22],
        where: `{3.EX.${record_id}}`
      })
    });
    if (!getRes.ok) throw new Error('QB GET error: ' + await getRes.text());
    const getData = await getRes.json();
    const record = getData.data?.[0];
    if (!record) throw new Error('Record not found: ' + record_id);

    const existing = record[QB_VARIANTS_FIELD]?.value || '';
    const answer = record[22]?.value || ''; 
    
    // Step 2: Check for duplicate before appending
    const variantsList = existing ? existing.split('|') : [];
    if (variantsList.includes(new_variant)) {
      return respond(200, {
        success: true,
        action: 'skipped',
        reason: 'Variant already exists'
      });
    }

    // Step 3: Append new variant to field 37
    const updated = existing ? `${existing}|${new_variant}` : new_variant;

    const putRes = await fetch('https://api.quickbase.com/v1/records', {
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
            "3": { value: record_id },
            [QB_VARIANTS_FIELD]: { value: updated }
          }
        ],
        fieldsToReturn: [QB_FIELD_ID, QB_VARIANTS_FIELD]
      })
    });
    if (!putRes.ok) throw new Error('QB PUT error: ' + await putRes.text());

    // Step 4: If create_record=true, create a new QB record for this variant
    if (create_record && answer) {
      if (!OPENAI_KEY) throw new Error('Missing OPENAI_API_KEY for embedding');

      // Normalize the variant question
      const normalizedVariant = new_variant
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Generate embedding for the variant
      const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_KEY}`
        },
        body: JSON.stringify({ model: EMBED_MODEL, input: new_variant })
      });
      if (!embeddingRes.ok) throw new Error('OpenAI error: ' + await embeddingRes.text());
      const embeddingData = await embeddingRes.json();
      const embedding = embeddingData.data[0].embedding;
      const embeddingString = embedding.join(',');

      // answer is already base64 encoded (coming from Voiceflow/QB)
      // decode for normalization only
      const answerDecoded = Buffer.from(answer, 'base64').toString('utf-8');
      const normalizedAnswer = answerDecoded
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // encode question to base64
      const questionBase64 = Buffer.from(new_variant).toString('base64');

      // Create new QB record
      const createRes = await fetch('https://api.quickbase.com/v1/records', {
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
              "6":  { value: questionBase64 },
              "7":  { value: answer },
              "22": { value: answer },
              "23": { value: normalizedAnswer },
              "9":  { value: 'correct' },
              "8":  { value: 'production' },
              "16": { value: true },
              "18": { value: normalizedVariant },
              "36": { value: embeddingString },
              "38": { value: true },
              "39": { value: record_id }
            }
          ],
          fieldsToReturn: [QB_FIELD_ID]
        })
      });
      if (!createRes.ok) throw new Error('QB Create error: ' + await createRes.text());
      const createData = await createRes.json();
      const newRecordId = createData.metadata?.createdRecordIds?.[0];
      return respond(200, {
        success: true,
        action: 'appended_and_created',
        record_id: record_id,
        new_record_id: newRecordId,
        variants: updated
      });
    }  // ← closes if (create_record && answer)

    return respond(200, {
      success: true,
      action: 'appended',
      record_id: record_id,
      variants: updated
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
