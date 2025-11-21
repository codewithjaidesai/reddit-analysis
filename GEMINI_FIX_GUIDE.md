# Gemini API Error Fix Guide

## 🔴 Problem
You're getting Gemini API errors when trying to generate AI insights.

## 🎯 Root Cause
The model name `gemini-2.5-flash` doesn't exist. Google recently launched new models, but the correct stable model is `gemini-1.5-flash-latest` or `gemini-1.5-flash`.

## ✅ Fix Applied
I've already updated your `code.gs` file to use `gemini-1.5-flash-latest` (the most stable current model).

---

## 🧪 How to Test in Google Apps Script (Before testing in UI)

### Step 1: Open Apps Script Editor
1. Go to https://script.google.com
2. Open your Reddit Analyzer project
3. You should see `code.gs` file

### Step 2: Run the Test Suite
I've created a test file for you. Here's how to use it:

1. **Create a new script file** in Apps Script:
   - Click the `+` next to Files
   - Name it `test-gemini.gs`
   - Copy the content from `/home/user/reddit-analysis/test-gemini.gs`

2. **Run the test**:
   - Select the function `testGeminiConnection` from the dropdown at the top
   - Click the ▶️ Run button
   - Grant permissions if asked (first time only)

3. **Check the logs**:
   - Click "View" → "Logs" (or press Ctrl+Enter)
   - You'll see detailed test results showing:
     - ✅ Which models are available
     - ✅ Which model works for your API key
     - ❌ Which models fail and why

### Step 3: Find the Working Model
The test will show you output like:
```
✅ SUCCESS! Model "gemini-1.5-flash-latest" works!
   Response: Hello! This model works!
```

### Step 4: Update code.gs (if needed)
If `gemini-1.5-flash-latest` doesn't work, the test will show you which model DOES work. Update line 11 in `code.gs`:

```javascript
model: 'YOUR_WORKING_MODEL_NAME_HERE',
```

---

## 🔧 Quick Test Functions You Can Run

### Test 1: List Available Models
```javascript
function quickTest1() {
  listAvailableModels();
}
```
This shows all models your API key can access.

### Test 2: Test Current Configuration
```javascript
function quickTest2() {
  testCurrentConfig();
}
```
This tests if your current model (gemini-1.5-flash-latest) works.

### Test 3: Test Multiple Models at Once
```javascript
function quickTest3() {
  testDifferentModels();
}
```
This tries 7 different model names and tells you which ones work.

---

## 📋 Common Gemini Model Names (2024-2025)

| Model Name | Speed | Quality | Context | Status |
|------------|-------|---------|---------|--------|
| `gemini-1.5-flash-latest` | ⚡ Fast | Good | 1M tokens | ✅ **Recommended** |
| `gemini-1.5-flash` | ⚡ Fast | Good | 1M tokens | ✅ Stable |
| `gemini-1.5-pro-latest` | 🐢 Slow | Excellent | 2M tokens | ✅ High quality |
| `gemini-1.5-pro` | 🐢 Slow | Excellent | 2M tokens | ✅ Stable |
| `gemini-2.0-flash-exp` | ⚡ Fast | Good | 1M tokens | ⚠️ Experimental |
| `gemini-2.5-flash` | N/A | N/A | N/A | ❌ **Does NOT exist** |

---

## 🚨 If You Still Get Errors

### Error 1: "API key not valid"
**Solution:**
- Go to https://aistudio.google.com/app/apikey
- Generate a new API key
- Make sure "Generative Language API" is enabled
- Replace the API key in line 10 of `code.gs`

### Error 2: "Model not found"
**Solution:**
- Run `listAvailableModels()` function
- Check which models are actually available for your account
- Some models require special access or billing enabled

### Error 3: "Quota exceeded"
**Solution:**
- You've hit the free tier limit (15 requests/minute, 1500/day)
- Wait a few minutes and try again
- Or upgrade to paid tier in Google AI Studio

### Error 4: "Safety settings blocked"
**Solution:**
- The AI refused to respond due to content safety
- This is rare with Reddit content but can happen
- Check the logs to see which safety category triggered

---

## 🎯 Testing From Your UI

Once you've confirmed the model works in Apps Script:

1. **Deploy your Apps Script**:
   - Click "Deploy" → "New deployment"
   - Type: "Web app"
   - Execute as: "Me"
   - Who has access: "Anyone"
   - Copy the deployment URL

2. **Update index.html** (if URL changed):
   - Line 769: Update `SCRIPT_URL` with your new deployment URL
   - This is only needed if you created a NEW deployment

3. **Test from UI**:
   - Open your index.html in a browser
   - Try to extract a Reddit post
   - Click "Generate Insights"
   - Check browser console (F12) for any errors

---

## 💡 What Changed on Google's Side?

Google recently:
1. ✅ Launched Gemini 2.0 (experimental)
2. ✅ Made 1.5 Flash more stable with "-latest" suffix
3. ❌ Never released a "2.5" version (your code had wrong name)
4. ✅ Improved context windows (now 1-2M tokens)

The `-latest` suffix ensures you always get the newest stable version without manually updating.

---

## 📞 Still Having Issues?

1. **Check the Apps Script logs**: Look for specific error messages
2. **Verify API key**: Make sure it's not expired or restricted
3. **Check quotas**: https://console.cloud.google.com/apis/dashboard
4. **Enable billing**: Some features require a billing account (even if free tier)

---

## ✅ Summary

**What I fixed:**
- ❌ Changed from `gemini-2.5-flash` (doesn't exist)
- ✅ Changed to `gemini-1.5-flash-latest` (current stable)

**How to test:**
1. Open Apps Script
2. Create test-gemini.gs file
3. Run `testGeminiConnection()`
4. Check logs for results

**If still broken:**
- The test will tell you exactly which model works
- Update code.gs line 11 with that model name
- Redeploy your Apps Script

That's it! 🎉
