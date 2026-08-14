# CrowdSense Mobile Client

The mobile client for **MapMyCity (CrowdSense)** is built using **Expo (SDK 54)**, **React Native (0.81)**, and **TypeScript**. It serves as the mobile interface for citizens to submit active geotagged issue reports or passively monitor road quality via accelerometer sensing during rides.

---

## 📱 Key Features

1. **Active Issue Reporting ([`CaptureScreen.tsx`](file:///d:/MapMyCity/crowdsense-app/src/screens/CaptureScreen.tsx))**:
   - Capture high-resolution photos of city issues (potholes, garbage, noise, accessibility obstacles, infrastructure damage).
   - Automatically record high-accuracy GPS coordinates, EXIF metadata, and timestamp tags.
   - Attach customized notes and issue category metadata prior to upload.

2. **Interactive Issue Map ([`MapScreen.tsx`](file:///d:/MapMyCity/crowdsense-app/src/screens/MapScreen.tsx))**:
   - Visualizes nearby verified and reported issue clusters using **React Native Maps** and **Map Clustering**.
   - Filters issue pins by status (`pending`, `approved`, `resolved`) and category.

4. **Submission History ([`SubmissionsScreen.tsx`](file:///d:/MapMyCity/crowdsense-app/src/screens/SubmissionsScreen.tsx))**:
   - Displays device submission history, moderation feedback, trust scores, and status flags.

5. **In-App Admin Dashboard ([`AdminScreen.tsx`](file:///d:/MapMyCity/crowdsense-app/src/screens/AdminScreen.tsx))**:
   - Allows administrators to inspect reports and cluster details directly inside the app (enabled via `EXPO_PUBLIC_ENABLE_ADMIN`).

6. **WCAG-Compliant Modern UI Theme ([`ThemeContext.tsx`](file:///d:/MapMyCity/crowdsense-app/src/theme/ThemeContext.tsx))**:
   - Dynamic Light and Dark mode theme engine with auto-detection of device preferences.

---

## 🛠️ Environment Configuration

Create a `.env` file in the root of `crowdsense-app` (or copy `.env.example`):

```bash
cp .env.example .env
```

Set the target server endpoints and API keys:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-string

# FastAPI Backend Endpoint
EXPO_PUBLIC_API_URL=http://192.168.0.146:8000

# Feature Flags
EXPO_PUBLIC_ENABLE_ADMIN=true
```

> **Note**: For physical mobile device testing, replace `http://localhost:8000` with your machine's local Wi-Fi IP address (e.g. `http://192.168.x.x:8000`).

---

## 🚀 Running the App & Getting the QR Code

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Expo Development Server
Run the Metro Bundler dev server:
```bash
npx expo start
```
or using npm:
```bash
npm start
```

### 3. Open on Mobile Devices (Scanning the QR Code)
- **Android**: Open the **Expo Go** app and tap **Scan QR code**, then point your camera at the QR code displayed in the terminal or dev tools window.
- **iOS**: Open the native **Camera** app, scan the QR code displayed in the terminal, and tap the **Expo Go** pop-up banner.
- **Tunnel Mode** (for testing across different networks):
  ```bash
  npx expo start --tunnel
  ```

### 4. Running on Emulators / Simulators
- **Android Emulator**: Press `a` in the terminal, or run `npm run android`.
- **iOS Simulator** (macOS only): Press `i` in the terminal, or run `npm run ios`.
- **Web Browser**: Press `w` in the terminal, or run `npm run web`.

---

## 📂 Project Structure

```
crowdsense-app/
├── assets/             # App icons, splash screens, and static images
├── src/
│   ├── components/     # Reusable UI elements (Buttons, Cards, Badges, Loaders)
│   ├── config/         # App constants, API routes, and Supabase client config
│   ├── screens/        # Primary application screens
│   │   ├── CaptureScreen.tsx      # Active issue camera & reporting
│   │   ├── RideModeScreen.tsx     # Passive accelerometer road quality logging
│   │   ├── MapScreen.tsx          # Geospatial interactive map
│   │   ├── SubmissionsScreen.tsx  # User report history & status track
│   │   └── AdminScreen.tsx        # Mobile moderator overview
│   ├── services/       # API integration & Supabase client handlers
│   ├── theme/          # Color tokens, typography, and theme context
│   ├── types.ts        # TypeScript interfaces & data models
│   └── utils/          # Device ID helper, location parsers, and storage
├── App.tsx             # Root React Native component & navigator setup
├── app.json            # Expo project manifest configuration
├── index.ts            # Entry point for Expo app registration
└── package.json        # Dependencies & launch scripts
```
