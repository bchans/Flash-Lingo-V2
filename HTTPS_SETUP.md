# HTTPS Setup for Mobile PWA Testing

## Problem
PWAs require HTTPS to be installable. `http://192.168.178.60:5000` doesn't work because it's not secure.

## Quick Solution: ngrok (HTTPS Tunnel)

### Step 1: Download ngrok
- Go to: https://ngrok.com/download
- Download for Windows
- Extract to a folder (e.g., `C:\ngrok`)

### Step 2: Run Your App
```bash
npm run dev
```

### Step 3: Create HTTPS Tunnel
Open a new terminal and run:
```bash
ngrok http 5000
```

### Step 4: Use the HTTPS URL
ngrok will give you a URL like:
```
https://abc123.ngrok.io
```

Open this URL on your phone → PWA install will work! ✅

---

## Alternative: Deploy to Vercel (Permanent HTTPS)

### Step 1: Create `vercel.json`
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": null,
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Step 2: Deploy
```bash
npm install -g vercel
vercel
```

Follow the prompts → Get `https://flashlingo.vercel.app` ✅

---

## Notes
- **ngrok**: Free, temporary URL (changes each restart), perfect for testing
- **Vercel**: Free, permanent URL, perfect for actual deployment
- Both give you HTTPS → PWA installation works on mobile!


