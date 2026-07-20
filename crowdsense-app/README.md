# CrowdSense Mobile Client

The mobile app for **MapMyCity (CrowdSense)** is built with **Expo (React Native)** and **TypeScript**. It serves as the frontend client for citizens to report city issues directly or passively log road anomalies.

---

## 📱 Key Features

1.  **Active Issue Reporting ([CaptureScreen.tsx](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/crowdsense-app/src/screens/CaptureScreen.tsx))**:
    *   Take photos of road and city issues using the camera.
    *   Record geolocation coordinates automatically via high-accuracy GPS.
    *   Add text notes and category tags before submitting.
2.  **Passive Road Sensing ([RideModeScreen.tsx](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/crowdsense-app/src/screens/RideModeScreen.tsx))**:
    *   **"Ride Mode"** registers vertical acceleration spikes (jolts) on the device's $Z$-axis using the accelerometer sensor (sampling at 20Hz).
    *   Filters device handling noise by calculating variance on $X$ and $Y$ axes. Standard deviation $\sigma_{xy} > 0.12G$ indicates device handling and silences alerts.
    *   Triggers heavy haptic feedback on jolt detection ($>0.45G$ vertical spike) and tags the GPS coordinates.
    *   Uploads detected road anomalies in bulk batches to `/submissions/passive-batch`.
3.  **Interactive Local Maps ([MapScreen.tsx](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/crowdsense-app/src/screens/MapScreen.tsx))**:
    *   Displays approved submission pins around the user's location.
4.  **Submission History ([SubmissionsScreen.tsx](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/crowdsense-app/src/screens/SubmissionsScreen.tsx))**:
    *   Lists reports submitted by the device and shows moderation statuses.
5.  **Admin Navigation Tab ([AdminScreen.tsx](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/crowdsense-app/src/screens/AdminScreen.tsx))**:
    *   Enables checking reports and clusters directly inside the mobile app when the admin flag is enabled.
6.  **WCAG Contrast-Compliant Themes**:
    *   Supports Light, Dark, and System-preference themes managed via a custom context provider ([ThemeContext.tsx](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/crowdsense-app/src/theme/ThemeContext.tsx)).

---

## 🛠️ Setup & Running

1.  **Configure Environment Variables**:
    *   Copy the template env file:
        ```bash
        cp .env.example .env
        ```
    *   Open `.env` and fill in the required variables:
        *   `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase URL.
        *   `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous API key.
        *   `EXPO_PUBLIC_API_URL`: The URL of your running backend (e.g. `http://127.0.0.1:8000` or `http://localhost:4000`).
        *   `EXPO_PUBLIC_ENABLE_ADMIN`: Set to `true` to display the "Admin" tab inside the bottom tab navigator.

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Start the Expo Packager**:
    ```bash
    npm start
    ```
    *   Press `a` to run on an Android emulator or device.
    *   Press `i` to run on an iOS simulator.
    *   Scan the QR code in the terminal with the Expo Go app to test on physical devices.

---

## 📂 Code Layout
*   **`src/screens/`**: Screens for Capture, Map, Ride Mode, History, and Admin dashboard.
*   **`src/components/`**: Standard interface components (Buttons, Card views, Badges, Loaders).
*   **`src/theme/`**: Theme tokens, colors, spacings, and theme context configurations.
*   **`src/services/`**: Submissions API wrapper handling network fetches.
*   **`src/utils/`**: Device identifier caches using AsyncStorage and coordinates parsing.
