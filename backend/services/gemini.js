const axios = require('axios');
const config = require('../config');

/**
 * Call Gemini API with automatic retry on 503 errors
 * @param {string} modelName - The model to use
 * @param {string} prompt - The prompt text
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<object>} Result object
 */
async function callGeminiWithRetry(modelName, prompt, maxRetries = 3) {
  // Gemini 3 and 2.5 models support higher token limits
  const isAdvancedModel = modelName.includes('3') || modelName.includes('2.5') || modelName.includes('pro');
  const maxOutputTokens = isAdvancedModel ? 65536 : 8192;
  const topK = isAdvancedModel ? 64 : 40;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const url = `${config.gemini.apiUrl}${modelName}:generateContent?key=${config.gemini.apiKey}`;

      const payload = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: config.gemini.temperature,
          topK: topK,
          topP: config.gemini.topP,
          maxOutputTokens: maxOutputTokens,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE"
          }
        ]
      };

      console.log(`Attempt ${attempt}/${maxRetries} for model: ${modelName}`);
      const response = await axios.post(url, payload);

      // Success!
      const result = response.data;

      // Extract the AI-generated text
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {

        // Concatenate ALL parts (Gemini splits long responses into multiple parts)
        const aiAnalysis = result.candidates[0].content.parts
          .map(part => part.text || '')
          .join('');
        console.log(`✅ Success! Analysis received (${aiAnalysis.length} chars, ${result.candidates[0].content.parts.length} parts) from ${modelName}`);

        return {
          success: true,
          analysis: aiAnalysis,
          model: modelName
        };
      } else {
        throw new Error('Unexpected response format from Gemini API');
      }

    } catch (error) {
      const statusCode = error.response?.status;

      // Handle different error codes
      if (statusCode === 503) {
        // Model overloaded - retry with exponential backoff
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`⚠️ Model overloaded (503). Waiting ${waitTime/1000}s before retry...`);

        if (attempt < maxRetries) {
          await sleep(waitTime);
          continue; // Retry
        } else {
          return {
            success: false,
            error: `Model ${modelName} is overloaded`,
            code: 503
          };
        }
      }

      if (statusCode === 429) {
        // Quota exceeded - don't retry, try different model
        console.log('❌ Quota exceeded (429)');
        return {
          success: false,
          error: 'API quota exceeded',
          code: 429
        };
      }

      if (statusCode === 404) {
        // Model not found - don't retry
        console.log(`❌ Model ${modelName} not found (404)`);
        return {
          success: false,
          error: `Model ${modelName} not available`,
          code: 404
        };
      }

      console.error(`Exception on attempt ${attempt}:`, error.message);

      if (attempt === maxRetries) {
        return {
          success: false,
          error: error.message,
          message: 'AI analysis failed: ' + error.message
        };
      }

      // Wait before retry
      await sleep(2000);
    }
  }

  // Should never reach here, but just in case
  return {
    success: false,
    error: 'Max retries exceeded',
    message: 'AI analysis failed after multiple attempts'
  };
}

/**
 * Analyze with Gemini (tries primary model, then fallbacks)
 * @param {string} prompt - The prompt text
 * @returns {Promise<object>} Result object
 */
async function analyzeWithGemini(prompt) {
  console.log('Calling Gemini API for AI analysis...');

  // Try primary model with retries
  const primaryResult = await callGeminiWithRetry(config.gemini.model, prompt, 3);

  if (primaryResult.success) {
    return primaryResult;
  }

  // If primary model failed with 503 (overloaded) or 429 (quota), try fallbacks
  console.log('Primary model failed, trying fallback models...');

  for (const fallbackModel of config.gemini.fallbackModels) {
    console.log(`Trying fallback model: ${fallbackModel}`);
    const result = await callGeminiWithRetry(fallbackModel, prompt, 2);

    if (result.success) {
      console.log(`✅ Fallback model ${fallbackModel} succeeded!`);
      return result;
    }
  }

  // All models failed
  return {
    success: false,
    error: 'All AI models failed. Google servers may be overloaded or quota exceeded.',
    message: 'AI analysis temporarily unavailable. Please try again in a few minutes, or check your API quota at https://console.cloud.google.com/apis/dashboard'
  };
}

/**
 * Analyze with a specific Gemini model (no fallback chain)
 * Used for map steps and pre-screening where we want a specific model
 * @param {string} prompt - The prompt text
 * @param {string} modelName - Specific model to use
 * @returns {Promise<object>} Result object
 */
async function analyzeWithModel(prompt, modelName) {
  console.log(`Calling specific Gemini model: ${modelName}`);
  const result = await callGeminiWithRetry(modelName, prompt, 3);

  if (result.success) {
    return result;
  }

  // If specific model failed, fall back to standard chain
  console.log(`Specific model ${modelName} failed, falling back to standard chain`);
  return analyzeWithGemini(prompt);
}

/**
 * Helper function to sleep
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  analyzeWithGemini,
  analyzeWithModel,
  callGeminiWithRetry
};
