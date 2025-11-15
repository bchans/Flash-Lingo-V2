# API Keys Setup Guide

## 🎉 Your App is Now Secure!

All API keys have been removed from the source code. They are now stored locally on your device and can be easily exported/imported.

---

## 📋 Quick Setup

### Option 1: Use the Built-in Settings (Recommended)

1. **Open your FlashLingo app**
2. **Click the ⚙️ Settings button** (top-right corner on home page)
3. **Enter your API keys** in the tabs:
   - **Gemini AI**: For grammar lessons, translations, and AI features
   - **Firebase**: For cloud functions (optional)
   - **Mistral AI**: For memory aids and translations
4. **Click "Save API Keys"**
5. ✅ Done! Your app will now use your personal API keys

### Option 2: Import from JSON File

1. **Edit the `api-keys-template.json` file** with your actual keys:
   ```json
   {
     "geminiApiKey": "YOUR_ACTUAL_GEMINI_KEY",
     "firebaseApiKey": "YOUR_ACTUAL_FIREBASE_KEY",
     "mistralApiKey": "YOUR_ACTUAL_MISTRAL_KEY"
   }
   ```

2. **Open Settings** in the app
3. **Click "Import"** button
4. **Select your edited JSON file**
5. ✅ Done!

---

## 🔑 Where to Get API Keys

### Gemini API (Google AI)
- **URL**: https://aistudio.google.com/app/apikey
- **Free Tier**: Yes (generous limits)
- **Used for**: Grammar lessons, image scanning, translations

### Mistral API
- **URL**: https://console.mistral.ai/
- **Free Tier**: Limited trial credits
- **Used for**: Memory aids, alternative translations

### Firebase (Optional)
- **URL**: https://console.firebase.google.com/
- **Free Tier**: Yes (Spark plan)
- **Used for**: Cloud functions (if you set them up)

---

## 💾 Export & Import Your Data

### Full Export (Cards + API Keys)
1. Go to **"My Cards"** page
2. Click **"Export Cards"**
3. Your exported file includes:
   - ✅ All flashcards
   - ✅ Grammar lessons & progress
   - ✅ Audio pronunciations
   - ✅ **API keys** (NEW!)

### Import on New Device
1. Go to **"My Cards"** page
2. Click **"Import Cards"**
3. Select your exported JSON file
4. Everything restores automatically, including API keys! 🎊

---

## 🚀 Deploy to Vercel

Now that your API keys are removed from the code, you can safely deploy:

```bash
# Deploy to Vercel (creates permanent HTTPS URL)
vercel
```

Your app will be available at: `https://flashlingo-yourusername.vercel.app`

**Benefits:**
- ✅ Permanent HTTPS URL (no ngrok needed!)
- ✅ Works on all devices
- ✅ PWA installs perfectly
- ✅ No API keys exposed in source code
- ✅ Free hosting

---

## 🔒 Security Notes

1. **Your API keys never leave your device** - they're stored in localStorage
2. **Export files contain your keys** - keep them private!
3. **You can deploy publicly** - no keys in the source code
4. **Each user adds their own keys** - perfect for sharing the app

---

## ⚡ Quick Reference

| Feature | Requires API Key? | Which One? |
|---------|------------------|------------|
| Create flashcards | ❌ No | None |
| Study flashcards | ❌ No | None |
| Grammar lessons | ✅ Yes | Gemini API |
| Image scanning | ✅ Yes | Gemini API |
| Memory aids | ✅ Yes | Mistral API |
| Text-to-Speech | ✅ Yes | Gemini/Firebase |

---

## 🆘 Troubleshooting

### "API key not configured" error
- Open Settings and add your API key for that service

### Can't see imported keys
- Close and reopen the Settings dialog
- Keys are there but hidden (click the 👁️ icon to reveal)

### Lost your keys?
- Export them from Settings before reinstalling
- Or just re-enter them (you still have them from the API providers)

---

## 🎯 Next Steps

1. ✅ Add your API keys in Settings
2. ✅ Test creating a grammar lesson or memory aid
3. ✅ Export your data (includes keys now!)
4. ✅ Deploy to Vercel for permanent HTTPS URL
5. ✅ Install as PWA on your phone - it works offline!

Enjoy your secure, deployable FlashLingo app! 🎉

