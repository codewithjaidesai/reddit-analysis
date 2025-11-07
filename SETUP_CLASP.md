# Setting Up clasp for Auto-Deployment

This guide helps you connect your GitHub repository to Google Apps Script for automatic deployments.

## Quick Setup (5 minutes)

### 1. Install clasp

```bash
npm install -g @google/clasp
```

### 2. Login to Google

```bash
clasp login
```

This opens a browser to authenticate with your Google account.

### 3. Get Your Script ID

1. Go to https://script.google.com
2. Open your existing Reddit Analyzer script
3. Click ⚙️ **Project Settings** (left sidebar)
4. Copy the **Script ID** (looks like: `1a2b3c4d5e6f7g8h9i0j`)

### 4. Create .clasp.json

Create a file named `.clasp.json` in your project root:

```json
{
  "scriptId": "YOUR_SCRIPT_ID_HERE",
  "rootDir": "."
}
```

Replace `YOUR_SCRIPT_ID_HERE` with the actual Script ID.

### 5. Test Manual Push

```bash
# Push code to Google Apps Script
clasp push

# Check it worked
clasp open
```

## Automated Deployment with GitHub Actions

### Setup Secrets

You need to add two secrets to your GitHub repository:

1. **CLASPRC_JSON** - Your clasp credentials
2. **CLASP_JSON** - Your project configuration

#### Get CLASPRC_JSON:

```bash
# After running 'clasp login', find this file:
cat ~/.clasprc.json
```

Copy the entire contents.

#### Get CLASP_JSON:

```bash
cat .clasp.json
```

Copy the entire contents.

### Add to GitHub:

1. Go to your GitHub repo
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add both secrets:
   - Name: `CLASPRC_JSON`, Value: (paste the content)
   - Name: `CLASP_JSON`, Value: (paste the content)

### Done! 🎉

Now every time you push `code.gs` to the main branch, it will automatically deploy to Google Apps Script!

## Daily Workflow

```bash
# Make changes to code.gs
vim code.gs

# Commit and push to GitHub
git add code.gs
git commit -m "Update insight extractors"
git push

# GitHub Actions automatically deploys to Apps Script!
```

## Manual Commands

```bash
# Push to Apps Script
clasp push

# Pull from Apps Script
clasp pull

# Open in browser
clasp open

# Deploy new version
clasp deploy

# View logs
clasp logs
```

## Troubleshooting

**Error: "User has not enabled the Apps Script API"**
- Go to https://script.google.com/home/usersettings
- Enable "Google Apps Script API"

**Error: "Syntax error in code.gs"**
- Run `clasp push` locally first to test
- Check the error message

**Permission denied**
- Run `clasp login` again
- Make sure you're logged into the correct Google account

## File Structure

```
reddit-analysis/
├── code.gs              # Apps Script backend
├── index.html           # Frontend (NOT pushed to Apps Script)
├── .clasp.json          # clasp configuration
├── .claspignore         # Files to ignore
└── .github/
    └── workflows/
        └── deploy-to-apps-script.yml  # Auto-deployment
```

## Testing the HTML

The `index.html` file is NOT pushed to Google Apps Script. To test:

1. Update `code.gs` (auto-deploys via clasp)
2. Open `index.html` locally in browser
3. It will call your deployed Google Apps Script endpoint

## Need Help?

- clasp docs: https://github.com/google/clasp
- Apps Script API: https://developers.google.com/apps-script/api/
