# BigTits — one app

**One Capacitor native app** for iOS and Android. React/Vite builds the **UI bundle** (`dist/`) that ships inside the native shell. You can OTA-update that web UI without an app-store release for most changes.

Gov Copilot is **not a separate app** — it is routes at `/gov/*` in this same bundle (voice, documents, portal autofill).

## Not TWA

The old `pwa-android-twa/` + Bubblewrap flow loaded a **remote website** in a Chrome wrapper. That is **removed**. Native Android/iOS = **Capacitor only**.

| | TWA (removed) | Capacitor (this app) |
|--|---------------|----------------------|
| UI source | Remote URL (Vercel) | Bundled `dist/` in APK |
| Native plugins | No mic, no WebView portal | STT/TTS, Portal Workspace |
| Offline | No | UI bundle local |
| OTA | Always remote | Deploy `dist/` or live-reload in dev |

Optional: `npm run vercel:deploy` still publishes a **browser preview** — not the native app.

## Layout

```text
app/
├── src/
│   ├── App.tsx              # /  +  /gov/*
│   ├── BigTitsHome.tsx      # chat, meta ads
│   └── features/gov/        # small gov module
├── server/gov/              # FastAPI for /gov API
├── native/portal-workspace/     # Android portal plugin (Kotlin)
├── native/portal-workspace-ios/ # iOS portal plugin (Swift)
├── scripts/
├── capacitor.config.ts
└── android/  ios/             # npx cap add (first time)
```

## Dev

```bash
npm install
# From repo root (starts API :3001 + Core :8000 + UI :5173):
npm run dev

# Or UI only (login will fail unless API is already on :3001):
npm run app:dev

# Gov API (second terminal)
npm run app:gov-api      # :8000 — vite proxies /gov-api
```

### Login: "Invalid JSON from API"

That means the UI got **HTML instead of JSON** (usually `index.html`), not a bad password.

| Where you're running | Fix |
|---------------------|-----|
| Browser `localhost:5173` | Run **`npm run dev` from repo root** so the API is up on `:3001` |
| Capacitor release build | Rebuild after pull — bundled apps now default to Railway API. For local API: `VITE_API_URL=http://10.0.2.2:3001 npm run build` then `cap sync` |
| Capacitor live-reload | `CAPACITOR_DEV=1` + `npm run dev` on your machine; emulator uses `10.0.2.2:5173` |

## Native (Capacitor) — Android + iOS

Same **one** `dist/` bundle ships to both platforms.

### First time

```bash
npm run cap:init         # adds android/ + ios/ if missing
npm run android:plugin   # Android portal autofill
npm run ios:plugin       # iOS portal autofill (run after cap:sync:ios too)
```

### Android

```bash
npm run cap:sync:android
npm run cap:open:android
```

Emulator API: `VITE_GOV_API_BASE_URL=http://10.0.2.2:8000/api/v1`  
Dev live-reload: `CAPACITOR_DEV=1 CAPACITOR_SERVER_URL=http://10.0.2.2:5173 npm run cap:sync:android`

### iOS (requires Mac + Xcode)

```bash
npm run cap:sync:ios
npm run cap:open:ios     # opens Xcode → run on simulator or device
```

Simulator API: `VITE_GOV_API_BASE_URL=http://127.0.0.1:8000/api/v1`  
Dev live-reload: `CAPACITOR_DEV=1 CAPACITOR_SERVER_URL=http://127.0.0.1:5173 npm run cap:sync:ios`

First iOS run in Xcode: **Product → Run** (⌘R). Signing: set your Team under Signing & Capabilities.

### Platform differences (Gov module)

| Feature | Android | iOS |
|---------|---------|-----|
| Chat, meta ads, `/gov` UI | ✅ | ✅ |
| Voice STT/TTS | ✅ | ✅ |
| Document upload / Qwen OCR | ✅ | ✅ |
| Portal autofill (WebView) | ✅ native plugin | ✅ native plugin (after `npm run ios:plugin`) |

Portal plugins: Android `native/portal-workspace/`, iOS `native/portal-workspace-ios/`.  
`npm run cap:sync:ios` runs `ios:plugin` automatically so Capacitor re-registers the in-app plugin.

## RunPod (shared GPU)

```bash
ssh -N -L 11435:127.0.0.1:11434 -i ~/.ssh/id_ed25519 fylvirr5y9slvo-64410ffb@ssh.runpod.io
```