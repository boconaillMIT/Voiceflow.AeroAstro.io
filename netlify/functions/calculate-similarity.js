exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { userEmbedding, qbRecords } = JSON.parse(event.body);

    if (!userEmbedding || !Array.isArray(userEmbedding)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid userEmbedding' })
      };
    }

    if (!qbRecords || !Array.isArray(qbRecords)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid qbRecords' })
      };
    }

    function cosineSimilarity(a, b) {
      if (a.length !== b.length) return 0;
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      if (normA === 0 || normB === 0) return 0;
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    const results = qbRecords.map(record => {
      const embedding = record.embedding.split(',').map(num => parseFloat(num.trim()));
      const similarity = cosineSimilarity(userEmbedding, embedding);
      return {
        record_id: record.record_id,
        question: record.question,
        answer: record.answer,
        similarity: similarity
      };
    });

    results.sort((a, b) => b.similarity - a.similarity);

    const bestMatch = results[0];
    const FLOOR_THRESHOLD = 0.80; // Make.com handles tiering above this

    if (bestMatch && bestMatch.similarity >= FLOOR_THRESHOLD) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          found: true,
          answer: bestMatch.answer,
          question_matched: bestMatch.question,
          similarityScore: bestMatch.similarity,
          record_id: bestMatch.record_id
        })
      };
    } else {
      return {
        statusCode: 200,
        body: JSON.stringify({
          found: false,
          similarityScore: bestMatch ? bestMatch.similarity : 0
        })
      };
    }

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};
