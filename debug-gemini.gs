/**
 * ENHANCED DEBUG SCRIPT FOR GEMINI 2.5 FLASH
 * Run this to see the EXACT error message
 */

const API_KEY = 'AIzaSyACsM5lAgXS16dCathjD3jeKD-yGCsDPws';

/**
 * Test gemini-2.5-flash with detailed error logging
 */
function debugGemini25Flash() {
  Logger.log('═══════════════════════════════════════════════');
  Logger.log('🔍 DEBUGGING GEMINI 2.5 FLASH');
  Logger.log('═══════════════════════════════════════════════\n');

  const model = 'gemini-2.5-flash';
  const prompt = "Say 'Hello! Gemini 2.5 Flash is working!' and nothing else.";

  Logger.log('Model: ' + model);
  Logger.log('API Key: ' + API_KEY.substring(0, 20) + '...');
  Logger.log('Test Prompt: ' + prompt);
  Logger.log('\n─────────────────────────────────────────────────\n');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 64,        // Updated for 2.5 (was 40 for older models)
        topP: 0.95,
        maxOutputTokens: 8192,
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

    Logger.log('📤 SENDING REQUEST...');
    Logger.log('URL: ' + url.replace(API_KEY, 'API_KEY_HIDDEN'));
    Logger.log('Payload: ' + JSON.stringify(payload, null, 2));
    Logger.log('\n─────────────────────────────────────────────────\n');

    const options = {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    Logger.log('📥 RESPONSE RECEIVED:');
    Logger.log('Status Code: ' + responseCode);

    if (responseCode !== 200) {
      Logger.log('\n❌ ERROR RESPONSE:');
      Logger.log('──────────────────────────────────────────────────');
      Logger.log(responseText);
      Logger.log('──────────────────────────────────────────────────\n');

      // Try to parse error
      try {
        const errorObj = JSON.parse(responseText);
        Logger.log('📋 PARSED ERROR:');
        Logger.log('Error Code: ' + (errorObj.error?.code || 'N/A'));
        Logger.log('Error Message: ' + (errorObj.error?.message || 'N/A'));
        Logger.log('Error Status: ' + (errorObj.error?.status || 'N/A'));

        if (errorObj.error?.details) {
          Logger.log('Error Details: ' + JSON.stringify(errorObj.error.details, null, 2));
        }
      } catch (e) {
        Logger.log('Could not parse error as JSON');
      }

      return {
        success: false,
        error: responseText
      };
    }

    // Success
    const result = JSON.parse(responseText);
    Logger.log('\n✅ SUCCESS!');
    Logger.log('──────────────────────────────────────────────────');
    Logger.log('Full Response: ' + JSON.stringify(result, null, 2));
    Logger.log('──────────────────────────────────────────────────\n');

    if (result.candidates && result.candidates.length > 0) {
      const text = result.candidates[0].content?.parts?.[0]?.text;
      Logger.log('📝 AI Response: ' + text);
    }

    return {
      success: true,
      response: result
    };

  } catch (error) {
    Logger.log('\n💥 EXCEPTION THROWN:');
    Logger.log('──────────────────────────────────────────────────');
    Logger.log(error.toString());
    Logger.log(error.stack);
    Logger.log('──────────────────────────────────────────────────\n');

    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Test with minimal payload (to rule out parameter issues)
 */
function testMinimalRequest() {
  Logger.log('🧪 Testing with MINIMAL payload...\n');

  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  const payload = {
    contents: [{
      parts: [{
        text: "Hello"
      }]
    }]
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  Logger.log('Payload: ' + JSON.stringify(payload, null, 2));

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  Logger.log('Response Code: ' + responseCode);

  if (responseCode === 200) {
    Logger.log('✅ Minimal request WORKS!');
    Logger.log('Issue is with our generationConfig or safetySettings');
  } else {
    Logger.log('❌ Even minimal request fails');
    Logger.log('Error: ' + responseText);
  }
}

/**
 * Compare working vs failing configs
 */
function compareConfigs() {
  Logger.log('🔬 TESTING DIFFERENT CONFIGURATIONS...\n');

  const tests = [
    {
      name: 'Minimal (no config)',
      config: {}
    },
    {
      name: 'With temperature only',
      config: {
        generationConfig: {
          temperature: 0.7
        }
      }
    },
    {
      name: 'With topK=40 (old default)',
      config: {
        generationConfig: {
          temperature: 0.7,
          topK: 40
        }
      }
    },
    {
      name: 'With topK=64 (2.5 default)',
      config: {
        generationConfig: {
          temperature: 0.7,
          topK: 64
        }
      }
    },
    {
      name: 'Full config (current code)',
      config: {
        generationConfig: {
          temperature: 0.7,
          topK: 64,
          topP: 0.95,
          maxOutputTokens: 8192
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE"
          }
        ]
      }
    }
  ];

  tests.forEach(test => {
    Logger.log(`\nTesting: ${test.name}`);
    Logger.log('─────────────────────────────────────────────────');

    const result = testConfig(test.config);

    if (result.success) {
      Logger.log(`✅ ${test.name} WORKS!`);
    } else {
      Logger.log(`❌ ${test.name} FAILED`);
      Logger.log(`Error: ${result.error.substring(0, 200)}`);
    }
  });
}

function testConfig(config) {
  try {
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    const payload = {
      contents: [{
        parts: [{
          text: "Say OK"
        }]
      }],
      ...config
    };

    const options = {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      return { success: true };
    } else {
      return {
        success: false,
        error: response.getContentText()
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * MAIN: Run all diagnostics
 */
function runFullDiagnostics() {
  Logger.log('\n\n');
  Logger.log('╔═══════════════════════════════════════════════╗');
  Logger.log('║  GEMINI 2.5 FLASH DIAGNOSTIC SUITE           ║');
  Logger.log('╚═══════════════════════════════════════════════╝');
  Logger.log('\n');

  // Test 1: Full debug
  debugGemini25Flash();

  Logger.log('\n\n');

  // Test 2: Minimal request
  testMinimalRequest();

  Logger.log('\n\n');

  // Test 3: Compare configs
  compareConfigs();

  Logger.log('\n\n');
  Logger.log('═══════════════════════════════════════════════');
  Logger.log('🏁 DIAGNOSTICS COMPLETE');
  Logger.log('═══════════════════════════════════════════════');
  Logger.log('\nCheck the logs above to find the exact issue.');
}
