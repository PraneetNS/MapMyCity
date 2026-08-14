# Master Screen Map & Navigation Architecture (`SCREEN_MAP.md`)

This document defines the complete screen inventory, route naming, authentication rules, and implementation status for **MapMyCity (CrowdSense)** across the mobile app (`crowdsense-app`) and administration portal (`crowdsense-admin`).

---

## 📱 Mobile Application Navigation Shell (`crowdsense-app`)

### 1. Auth & Onboarding Stack (Unauthenticated Stack)

| Screen Name | Route Key | Auth Req | Corresponding Build | Status | Description |
|---|---|---|---|---|---|
| **Splash / Launch** | `Splash` | None | Navigation Pass | **BUILT** | Branded loading screen checking local session token & device hardware capabilities. |
| **Language Selection** | `LanguageSelect` | None | Onboarding Pass | **BUILT** | First-screen multilingual Indian language picker (English, Hindi, Kannada, Tamil, Telugu, Marathi, Bengali). |
| **Phone Authentication** | `PhoneAuth` | None | Phone Auth Pass | **BUILT** | Phone number entry & SHA-256 phone hashing (`auth.ts` / `AuthScreen.tsx`). |
| **OTP Verification** | `OTPVerify` | None | Phone Auth Pass | **BUILT** | 6-digit SMS OTP verification screen. |
| **Blocking Consent** | `Consent` | None | Legal & Consent Pass | **BUILT** | ToS v1.1 + Privacy Policy v1.1 + Grievance Officer details. Must accept to proceed. |
| **Silent Device Check** | `SilentDeviceCheck` | None | Low-End Device Pass | **BUILT** | Silent hardware check (`Device.totalMemory < 3GB`) auto-enabling Lite Mode before main app launch. |

---

### 2. Main Application Bottom Tabs (Authenticated)

| Tab Name | Route Key | Icon | Corresponding Build | Status | Primary Component |
|---|---|---|---|---|---|
| **Home / Map** | `HomeTab` | `MapPin` | Realtime Map Pass | **BUILT** | [`MapScreen.tsx`](file:///d:/MapMyCity/crowdsense-app/src/screens/MapScreen.tsx) with toggleable issue, hazard, utility, and safety concern layers. |
| **Report** | `ReportTab` | `PlusCircle` (Modal) | Multi-Category Pass | **BUILT** | **Center Modal Launcher** pushing [`ReportModalStack`](file:///d:/MapMyCity/crowdsense-app/src/screens/ReportCategoryPickerScreen.tsx). |
| **My Reports** | `MyReportsTab` | `List` | History Pass | **BUILT** | [`SubmissionsScreen.tsx`](file:///d:/MapMyCity/crowdsense-app/src/screens/SubmissionsScreen.tsx) with sync status, retry triggers, and subscribed clusters. |
| **Profile & Settings** | `ProfileTab` | `User` | Production Readiness | **BUILT** | [`ProfileSettingsScreen.tsx`](file:///d:/MapMyCity/crowdsense-app/src/screens/ProfileSettingsScreen.tsx) consolidating gamification, Lite Mode, Storage & Cache, Legal, and Notifications. |

---

### 3. Report Modal Stack (`ReportModalStack`)

| Screen Name | Route Key | Auth Req | Corresponding Build | Status | Description |
|---|---|---|---|---|---|
| **Category Picker** | `ReportCategoryPicker` | Auth | New Categories Pass | **BUILT** | Central branch picker (Standard / Accessibility / Women Safety / Utility Outage). |
| **Standard Photo + Voice** | `CaptureStandard` | Auth | Voice & Photo Pass | **BUILT** | [`CaptureScreen.tsx`](file:///d:/MapMyCity/crowdsense-app/src/screens/CaptureScreen.tsx) with camera capture, mandatory category, and optional voice note. |
| **Accessibility Audit** | `AccessibilityAuditForm` | Auth | Accessibility Pass | **BUILT** | [`AccessibilityAuditFormScreen.tsx`](file:///d:/MapMyCity/crowdsense-app/src/screens/AccessibilityAuditFormScreen.tsx) for NGO/CSR accessibility reporting. |
| **Women's Safety Concern** | `SafetyConcernForm` | Auth | Women's Safety Pass | **BUILT** | [`SafetyConcernFormScreen.tsx`](file:///d:/MapMyCity/crowdsense-app/src/screens/SafetyConcernFormScreen.tsx) for photo-optional anonymous safety mapping. |
| **Utility Disruption** | `UtilityOutageForm` | Auth | Utility Outage Pass | **BUILT** | [`UtilityOutageFormScreen.tsx`](file:///d:/MapMyCity/crowdsense-app/src/screens/UtilityOutageFormScreen.tsx) for quick photo-free water/power status reports. |
| **Cluster Detail Link** | `ClusterDetail` | Auth | Routing Hardening | **BUILT** | [`ClusterDetailScreen.tsx`](file:///d:/MapMyCity/crowdsense-app/src/screens/ClusterDetailScreen.tsx) for deep-link cluster views with 404 fallback. |

---

### 4. Root Cross-Cutting Overlays

| Overlay Name | Component | Auth Req | Status | Trigger Condition |
|---|---|---|---|---|
| **Emergency Hazard Takeover** | [`HazardAlertTakeoverModal.tsx`](file:///d:/MapMyCity/crowdsense-app/src/components/HazardAlertTakeoverModal.tsx) | Any | **BUILT** | Broadcast flood/disaster alert fires (`waterlogging`, `road_closure`). |
| **Persistent Offline Banner** | [`OfflineBanner.tsx`](file:///d:/MapMyCity/crowdsense-app/src/components/OfflineBanner.tsx) | Any | **BUILT** | Network connectivity drops (`NetInfo.isConnected === false`). |
| **App Error Boundary** | [`ErrorBoundary.tsx`](file:///d:/MapMyCity/crowdsense-app/src/components/ErrorBoundary.tsx) | Any | **BUILT** | Uncaught React UI component exception. |

---

## 🖥️ Administration Portal (`crowdsense-admin`)

| Dashboard Section | Tab Key | Auth Role | Status | Implementation File |
|---|---|---|---|---|
| **Overview & Metrics** | `overview` | Moderator+ | **BUILT** | [`page.tsx`](file:///d:/MapMyCity/crowdsense-admin/src/app/page.tsx) Lines 440-520 |
| **Standard Moderation** | `submissions` | Moderator+ | **BUILT** | [`page.tsx`](file:///d:/MapMyCity/crowdsense-admin/src/app/page.tsx) Lines 530-610 |
| **Safety Priority Queue** | `safety` | Moderator+ | **BUILT** | [`page.tsx`](file:///d:/MapMyCity/crowdsense-admin/src/app/page.tsx) Lines 620-680 |
| **Accessibility NGO Audits** | `accessibility` | Partner+ | **BUILT** | [`page.tsx`](file:///d:/MapMyCity/crowdsense-admin/src/app/page.tsx) Lines 690-760 |
| **Utility Outages Ward View** | `utilities` | Partner+ | **BUILT** | [`page.tsx`](file:///d:/MapMyCity/crowdsense-admin/src/app/page.tsx) Lines 770-830 |
| **Flagged Content Queue** | `flagged` | Moderator+ | **BUILT** | [`page.tsx`](file:///d:/MapMyCity/crowdsense-admin/src/app/page.tsx) Lines 840-910 |
| **User Controls & Bans** | `users` | SuperAdmin | **BUILT** | [`page.tsx`](file:///d:/MapMyCity/crowdsense-admin/src/app/page.tsx) Lines 920-980 |
| **Cluster Map View** | `map` | Moderator+ | **BUILT** | [`page.tsx`](file:///d:/MapMyCity/crowdsense-admin/src/app/page.tsx) Lines 990-1080 |
