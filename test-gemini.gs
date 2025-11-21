/**
 * TEST FILE: Use this to test Gemini API directly in Apps Script
 *
 * HOW TO USE:
 * 1. Open Google Apps Script editor (script.google.com)
 * 2. Copy this file's content into your project
 * 3. Run testGeminiConnection() function
 * 4. Check the logs (View > Logs or Ctrl+Enter)
 */

// Your API Key (same as in code.gs)
const API_KEY = 'AIzaSyACsM5lAgXS16dCathjD3jeKD-yGCsDPws';

/**
 * Test 1: List all available Gemini models
 * This will show you which models you can actually use
 */
function listAvailableModels() {
  Logger.log('🔍 Checking available Gemini models...');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

    const options = {
      method: 'GET',
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    Logger.log('Response code: ' + responseCode);

    if (responseCode !== 200) {
      const errorText = response.getContentText();
      Logger.log('❌ ERROR: ' + errorText);
      return {
        success: false,
        error: errorText
      };
    }

    const result = JSON.parse(response.getContentText());

    // List models that support generateContent
    Logger.log('\n📋 Available models that support generateContent:');
    Logger.log('================================================');

    if (result.models) {
      result.models.forEach(model => {
        if (model.supportedGenerationMethods &&
            model.supportedGenerationMethods.includes('generateContent')) {
          Logger.log('✅ ' + model.name);
          Logger.log('   Display Name: ' + model.displayName);
          Logger.log('   Description: ' + (model.description || 'N/A'));
          Logger.log('   Input Token Limit: ' + (model.inputTokenLimit || 'N/A'));
          Logger.log('   Output Token Limit: ' + (model.outputTokenLimit || 'N/A'));
          Logger.log('');
        }
      });
    }

    return {
      success: true,
      models: result.models
    };

  } catch (error) {
    Logger.log('❌ EXCEPTION: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Test 2: Try different model names to see which works
 */
function testDifferentModels() {
  const modelsToTest = [
    'gemini-2.5-flash',           // Your current setting
    'gemini-2.0-flash-exp',       // Experimental 2.0
    'gemini-1.5-flash',           // Stable 1.5 Flash
    'gemini-1.5-flash-latest',    // Latest 1.5 Flash
    'gemini-1.5-pro',             // Stable 1.5 Pro
    'gemini-1.5-pro-latest',      // Latest 1.5 Pro
    'gemini-pro'                  // Original Gemini Pro
  ];

  const testPrompt = "Say 'Hello! This model works!' and nothing else.";

  Logger.log('🧪 Testing different model names...');
  Logger.log('================================================\n');

  modelsToTest.forEach(modelName => {
    Logger.log(`Testing: ${modelName}`);
    const result = testModelName(modelName, testPrompt);

    if (result.success) {
      Logger.log(`✅ SUCCESS! Model "${modelName}" works!`);
      Logger.log(`   Response: ${result.response.substring(0, 100)}...`);
    } else {
      Logger.log(`❌ FAILED: ${result.error}`);
    }
    Logger.log('');
  });
}

/**
 * Helper: Test a specific model name
 */
function testModelName(modelName, prompt) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;

    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 100
      }
    };

    const options = {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      const errorText = response.getContentText();
      return {
        success: false,
        error: `HTTP ${responseCode}: ${errorText.substring(0, 200)}`
      };
    }

    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {

      return {
        success: true,
        response: result.candidates[0].content.parts[0].text
      };
    } else {
      return {
        success: false,
        error: 'Unexpected response format'
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
 * Test 3: Full test of your current configuration
 */
function testCurrentConfig() {
  Logger.log('🔧 Testing your current configuration...');
  Logger.log('Model: gemini-2.5-flash');
  Logger.log('API Key: ' + API_KEY.substring(0, 10) + '...');
  Logger.log('================================================\n');

  const result = testModelName('gemini-2.5-flash', 'Say hello!');

  if (result.success) {
    Logger.log('✅ Current config WORKS!');
    Logger.log('Response: ' + result.response);
  } else {
    Logger.log('❌ Current config FAILED!');
    Logger.log('Error: ' + result.error);
    Logger.log('\n💡 Suggestion: Run testDifferentModels() to find a working model');
  }
}

/**
 * MAIN TEST: Run this first!
 */
function testGeminiConnection() {
  Logger.log('═══════════════════════════════════════════════');
  Logger.log('🚀 GEMINI API TEST SUITE');
  Logger.log('═══════════════════════════════════════════════\n');

  // Test 1: Check API key and list models
  Logger.log('TEST 1: Listing available models...\n');
  const modelList = listAvailableModels();

  if (!modelList.success) {
    Logger.log('\n❌ CRITICAL: Cannot connect to Gemini API!');
    Logger.log('Possible issues:');
    Logger.log('  1. API key is invalid or expired');
    Logger.log('  2. API key doesn\'t have Gemini API enabled');
    Logger.log('  3. Network/firewall blocking the request');
    Logger.log('\n🔑 Your API Key: ' + API_KEY.substring(0, 20) + '...');
    return;
  }

  Logger.log('\n─────────────────────────────────────────────────\n');

  // Test 2: Test current model
  Logger.log('TEST 2: Testing your current model...\n');
  testCurrentConfig();

  Logger.log('\n─────────────────────────────────────────────────\n');

  // Test 3: Try alternatives if current fails
  Logger.log('TEST 3: Testing alternative models...\n');
  testDifferentModels();

  Logger.log('\n═══════════════════════════════════════════════');
  Logger.log('✅ TEST SUITE COMPLETE!');
  Logger.log('Check the logs above to see which model works.');
  Logger.log('═══════════════════════════════════════════════');
}
