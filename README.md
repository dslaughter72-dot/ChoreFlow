# ⭐ ChoreFlow — Deploy Guide

A family chore tracker with PIN login, tiered chores, earnings tracking, and rewards.
Installable on iPhone & Android as a PWA (no app store needed).

---

## 🚀 Deploy to Vercel (Free — takes ~5 minutes)

### Step 1: Create a GitHub account
Go to https://github.com and sign up for free if you don't have one.

### Step 2: Create a new repository
1. Click the **+** button → **New repository**
2. Name it `choreflow`
3. Set it to **Public**
4. Click **Create repository**

### Step 3: Upload your files
1. On your new repo page, click **uploading an existing file**
2. Drag and drop ALL the files from this zip (keep the folder structure intact)
3. Click **Commit changes**

### Step 4: Deploy on Vercel
1. Go to https://vercel.com and sign up with your GitHub account
2. Click **Add New Project**
3. Select your `choreflow` repository
4. Leave all settings as default — Vercel auto-detects Vite
5. Click **Deploy**
6. Wait ~1 minute ✅

### Step 5: Get your link
Vercel gives you a free URL like:
`https://choreflow-abc123.vercel.app`

You can also set a custom domain if you have one!

---

## 📱 Install on iPhone (Add to Home Screen)

1. Open your Vercel URL in **Safari** (must be Safari on iPhone)
2. Tap the **Share** button (box with arrow at bottom)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add**
5. ChoreFlow now has its own icon on the home screen! 🎉

## 📱 Install on Android

1. Open your Vercel URL in **Chrome**
2. Tap the **three dots** menu (top right)
3. Tap **Add to Home screen**
4. Tap **Add**

---

## 🔐 Default PINs (change these in the app!)
- Kid 1 → 1234
- Kid 2 → 2345
- Kid 3 → 3456
- Parent → 0000

Log in as Parent → Edit tab to update all PINs and names.

---

## 🛠 Run locally (optional)
```bash
npm install
npm run dev
```
Then open http://localhost:5173
