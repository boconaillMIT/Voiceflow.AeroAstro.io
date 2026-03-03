exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { userEmbedding, qbRecords } = JSON.parse(event.body);

    // Add this line after parsing:
const userEmbeddingArray = typeof userEmbedding === 'string'
  ? userEmbedding.split(',').map(num => parseFloat(num.trim()))
  : userEmbedding;
    
    // Validate input
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

    // Calculate cosine similarity
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

    // Calculate similarity for each record
    const results = qbRecords.map(record => {
      // Parse the embedding string back to array
      const embedding = record.embedding.split(',').map(num => parseFloat(num.trim()));
      const similarity = cosineSimilarity(userEmbeddingArray, embedding);
      
      return {
        record_id: record.record_id,
        question: record.question,
        answer: record.answer,
        similarity: similarity
      };
    });

    // Sort by similarity (highest first)
    results.sort((a, b) => b.similarity - a.similarity);

    // Get best match
    const bestMatch = results[0];
    const THRESHOLD = 0.85; // Minimum similarity to consider a match

    if (bestMatch && bestMatch.similarity >= THRESHOLD) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          found: true,
          answer: bestMatch.answer,
          question_matched: bestMatch.question,
          confidence: bestMatch.similarity,
          record_id: bestMatch.record_id
        })
      };
    } else {
      return {
        statusCode: 200,
        body: JSON.stringify({
          found: false,
          best_similarity: bestMatch ? bestMatch.similarity : 0
        })
      };
    }

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
