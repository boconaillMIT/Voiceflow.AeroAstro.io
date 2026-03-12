const QB_REALM = 'mit.quickbase.com';
const QB_TABLE = 'bvi4py32v';
const QB_VARIANTS_FIELD = 37;
const QB_FIELD_ID = 3;

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return respond(405, { success: false, error: 'Method not allowed' });
  }

  let record_id, new_variant;
  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;
    const body = JSON.parse(rawBody);
    record_id = body.record_id;
    new_variant = body.new_variant;
    if (!record_id) throw new Error('Missing record_id');
    if (!new_variant) throw new Error('Missing new_variant');
  } catch (e) {
    return respond(400, { success: false, error: 'Invalid body: ' + e.message });
  }

  const QB_TOKEN = process.env.QB_TOKEN;
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
        select: [QB_FIELD_ID, QB_VARIANTS_FIELD],
        where: `{3.EX.${record_id}}`
      })
    });
    if (!getRes.ok) throw new Error('QB GET error: ' + await getRes.text());
    const getData = await getRes.json();
    const record = getData.data?.[0];
    if (!record) throw new Error('Record not found: ' + record_id);

    const existing = record[QB_VARIANTS_FIELD]?.value || '';

    // Step 2: Check for duplicate before appending
    const variantsList = existing ? existing.split('|') : [];
    if (variantsList.includes(new_variant)) {
      return respond(200, {
        success: true,
        action: 'skipped',
        reason: 'Variant already exists'
      });
    }

    // Step 3: Append new variant
    const updated = existing ? `${existing}|${new_variant}` : new_variant;

    // Step 4: PUT updated variants back
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
