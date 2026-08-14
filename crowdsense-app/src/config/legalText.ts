export const LEGAL_VERSIONS = {
  TOS_VERSION: '2.0.0-IN',
  PRIVACY_VERSION: '2.0.0-IN',
  LAST_UPDATED: 'August 15, 2026',
};

export const GRIEVANCE_OFFICER = {
  name: 'Nodal Compliance & Grievance Officer',
  designation: 'Nodal Grievance Officer, CrowdSense Civic Platform',
  email: 'grievance@mapmycity.org',
  address: 'CrowdSense Platform, IT Park, Outer Ring Road, Bengaluru, Karnataka 560001',
  responseTimeline: 'Acknowledged within 24 hours, resolved within 15 days under Information Technology (Intermediary Guidelines) Rules, 2021 and DPDP Act, 2023.',
};

export const THIRD_PARTY_SUBPROCESSORS = [
  {
    name: 'Supabase Inc.',
    purpose: 'PostgreSQL Database, User Authentication & Row-Level Security',
    dataShared: 'Hashed phone numbers, encrypted profile metadata, submission records',
    location: 'AWS Mumbai (ap-south-1), India',
  },
  {
    name: 'Cloudinary Ltd.',
    purpose: 'Media storage, image optimization, and CDN delivery',
    dataShared: 'Civic issue photographs and before/after resolution photos',
    location: 'Encrypted Cloud Storage (India & Global Edge CDN)',
  },
  {
    name: 'Sightengine SAS',
    purpose: 'Server-side automated content moderation (NSFW, gore, violence prevention)',
    dataShared: 'Submitted photos (processed transiently in-memory, not retained)',
    location: 'Secure Processing API',
  },
  {
    name: 'Twilio / SMS Gateway',
    purpose: 'One-Time Password (OTP) verification',
    dataShared: 'Phone number (transiently during SMS delivery)',
    location: 'Telecom Carrier Gateway',
  },
];

export const DATA_RETENTION_SCHEDULE = [
  {
    dataType: 'Phone Number (Account Identity)',
    retentionPeriod: 'Lifetime of active account; permanently erased upon account deletion request.',
    storageMethod: 'Irreversible SHA-256 cryptographic hash with unique salt.',
  },
  {
    dataType: 'Civic Issue Reports & GPS Coordinates',
    retentionPeriod: 'Retained indefinitely as public civic infrastructure data (decoupled from user identity on account deletion).',
    storageMethod: 'PostGIS spatial database tables with Row-Level Security (RLS).',
  },
  {
    dataType: 'Photographs (Approved Reports)',
    retentionPeriod: 'Retained as public evidence for municipal tracking and resolution verification.',
    storageMethod: 'Cloudinary secure CDN storage.',
  },
  {
    dataType: 'Photographs (Policy-Rejected)',
    retentionPeriod: 'Purged immediately upon rejection; not retained.',
    storageMethod: 'Transient memory buffer.',
  },
  {
    dataType: 'Approximate Location (Alert Target)',
    retentionPeriod: 'Session-only in working RAM; discarded upon session completion. No persistent movement history is recorded.',
    storageMethod: 'In-memory ephemeral buffer.',
  },
  {
    dataType: 'Voice Audio Recordings',
    retentionPeriod: 'Zero server retention. Processed 100% on-device via local ASR.',
    storageMethod: 'Raw audio never leaves citizen device.',
  },
];

export const TERMS_OF_SERVICE_MD = `TERMS OF SERVICE (CROWDSENSE PLATFORM - INDIA)
Effective Date: August 15, 2026 | Version 2.0.0-IN

Welcome to CrowdSense (MapMyCity). By installing, accessing, or using this mobile application, you agree to comply with and be bound by these Terms of Service in accordance with the laws of India, including the Information Technology Act, 2000, the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and the Digital Personal Data Protection (DPDP) Act, 2023.

---

### 1. Genuine Civic Issue Reporting & Anti-Spam Guidelines
CrowdSense is an open civic participation platform dedicated exclusively to documenting and resolving genuine public infrastructure hazards (such as potholes, overflowing garbage, broken streetlights, waterlogging, utility outages, and public accessibility barriers).

You strictly agree and attest that you will NOT:
• Submit false, fabricated, malicious, or exaggerated reports targeting any individual, merchant, or property.
• Upload photos containing identifiable private individuals or private indoor residences without explicit consent.
• Use the application for defamation, extortion, political smearing, commercial advertising, or harassment.
• Upload content depicting explicit nudity, violence, weapons, or hate speech.

---

### 2. Live Community Hazard Alerts Disclaimer
Real-time hazard alerts (such as road blockages, emergency waterlogging, or fallen power lines) are crowdsourced for community awareness. While automated verification and peer upvoting are employed:
• CrowdSense does NOT replace official emergency response services (Police, Fire, Ambulance 112).
• No warranty of immediate accuracy or municipal repair turnaround is guaranteed.

---

### 3. User Identity & Account Accountability
• Access is authenticated via verified phone number OTP.
• Deliberate abuse, spamming, or submitting defamatory content will result in immediate permanent account suspension and potential referral under applicable Indian penal provisions.

---

### 4. Mandatory Attestation & Dispute Redressal
Every submission requires citizen attestation of genuine civic intent. In compliance with Rule 3(2) of the IT Intermediary Rules 2021, grievances may be filed directly with our Nodal Grievance Officer:
• Email: grievance@mapmycity.org
• Acknowledgment: Within 24 hours | Resolution: Within 15 calendar days.
`;

export const PRIVACY_POLICY_MD = `PRIVACY POLICY & DATA-HANDLING DISCLOSURE
Effective Date: August 15, 2026 | Version 2.0.0-IN | Digital Personal Data Protection (DPDP) Act Compliant

CrowdSense ("MapMyCity") is engineered on principles of strict data minimization, on-device computation, and citizen privacy. This policy provides a comprehensive disclosure of how every data item is handled.

---

### 1. Data Collection & Processing Breakdown

#### A. Mobile Phone Numbers
• **Purpose**: Secure account identity, OTP authentication, and platform abuse prevention (rate limiting, spam defense).
• **Storage & Encryption**: Stored as an irreversible SHA-256 cryptographic hash. Your plaintext phone number is never stored on our database servers.
• **Sharing**: Never shared with municipal bodies, NGO partners, advertisers, or third parties in identifiable form.
• **Retention**: Retained for the lifetime of your account; permanently purged upon account deletion.

#### B. Precise Geolocation (GPS) Data
• **Purpose**: Pinpointing civic infrastructure defects and mapping ward hazard densities.
• **Submission Coordinates**: Attached to public civic reports and retained indefinitely as open public infrastructure data. Upon account deletion, the GPS coordinates remain on the civic map but are completely decoupled from your user profile.
• **Last-Known Location (Alerts)**: Used strictly in-memory during active sessions to deliver relevant ward hazard alerts. **CrowdSense does NOT record, track, or retain continuous movement or location history.**

#### C. Photographs & Media
• **Purpose**: Visual documentation of civic defects for verification and contractor work orders.
• **Storage & Screening**: Uploaded to Cloudinary CDN. Every photo undergoes pre-upload automated NSFW and safety screening.
• **Policy Violations**: Photos flagged for explicit content or harassment are rejected and purged immediately.

#### D. Voice Recordings & Audio
• **On-Device Guarantee**: Raw voice audio is transcribed **100% on-device** using local speech recognition models. **Raw audio files NEVER leave your mobile device and are never uploaded to any server.** Only the resulting transcribed text is transmitted.

---

### 2. Category Visibility & Anonymity Matrix

| Category | Public Map Visibility | Reporter Identity Status | Partner Sharing |
|---|---|---|---|
| **Potholes & Road Damage** | Public (Photo, GPS, Notes) | Anonymous (UUID/Hash hidden) | Municipal Public Works |
| **Garbage & Sanitation** | Public (Photo, GPS, Notes) | Anonymous | Municipal Sanitation Ward |
| **Streetlight & Infrastructure** | Public (Photo, GPS, Notes) | Anonymous | Municipal Electricity Dept |
| **Women's Safety Concerns** | Heatmap / Anonymized Only | **Strictly Anonymous** | Municipal Safety & Police Planning |
| **Accessibility Audits** | Public Checklist Data | Anonymous | Disability Advocacy NGOs & CSR Partners |

---

### 3. Third-Party Sub-Processors
Data passes only through verified technical infrastructure providers under strict Data Processing Agreements:
• **Supabase Inc.** (Database & Auth, Hosted in AWS Mumbai, India)
• **Cloudinary Ltd.** (Encrypted Media CDN)
• **Sightengine SAS** (Automated Content Safety Screening)
• **Twilio / Telecom Gateway** (SMS OTP delivery only)

---

### 4. Your Rights under India's DPDP Act, 2023
You maintain complete control over your personal data:
• **Right to Access & Portability**: Download a complete JSON bundle of your profile and report history anytime from Profile Settings → Export Data.
• **Right to Erasure (Account Deletion)**: Permanently delete your account. Your profile and phone hash are permanently purged from all servers within 30 days.
• **Right to Grievance Redressal**: Contact our Nodal Grievance Officer at grievance@mapmycity.org.

---

### 5. Children's Data Policy
CrowdSense is designed for citizens aged 18 and above (or aged 13–17 with verifiable parental consent). We do not knowingly collect personal data from minors under 13.

---

### 6. Consent Versioning & Updates
Any material changes to this policy will trigger an in-app consent re-prompt before continued platform use.
`;
