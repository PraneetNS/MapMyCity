# CrowdSense Admin Dashboard

This is the Next.js administration portal for **MapMyCity (CrowdSense)**. It provides city administrators and moderators with a dashboard to monitor, review, and moderate submitted reports.

---

## 🚀 Key Features

*   **Secure Password Gate**: Access to dashboard data is protected via an administrator password page (configured to check for the password `admin123`).
*   **Geospatial Visualization**: Displays submission groups (clusters) on an interactive, client-side rendered OpenStreetMap powered by Leaflet.js. Pin icons are color-coded by lifecycle status:
    *   🔴 **Active Cluster**: Rose red.
    *   🟢 **Resolved Cluster**: Emerald green.
    *   ⚪ **Stale Cluster**: Slate grey.
*   **Real-time Analytics**: Computes running indicators including total submissions, approval rates, pending queues, and system health status.
*   **Moderation Interface**: View photos, device trust scores, and submission flags (like duplicate hashes, speed limits, and EXIF mismatch alerts). Moderators can approve or reject submissions in real time.

---

## 🛠️ Tech Stack

*   **Framework**: [Next.js](https://nextjs.org/) (App Router, version 14)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: Vanilla CSS (embedded in [globals.css](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/crowdsense-admin/src/app/globals.css))
*   **Mapping**: [Leaflet.js](https://leafletjs.com/) (React client side wrapper)
*   **Icons**: [Lucide React](https://lucide.dev/)

---

## ⚙️ Getting Started

### Development
1. Ensure the backend FastAPI server is running (usually at `http://127.0.0.1:8000`).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production
1. Build the production application:
   ```bash
   npm run build
   ```
2. Start the built server:
   ```bash
   npm start
   ```

---

## 📂 Code Structure
*   **[src/app/page.tsx](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/crowdsense-admin/src/app/page.tsx)**: Main application single-page dashboard containing authentication logic, Leaflet map setup, filters, state, and dashboard stats.
*   **[src/app/globals.css](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/crowdsense-admin/src/app/globals.css)**: Global CSS rules, colors, and design styling.
*   **[src/supabase.ts](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/crowdsense-admin/src/supabase.ts)**: Supabase client-side config references.
