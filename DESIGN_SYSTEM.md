# CrowdSense Design System (v1.0)

## Overview
CrowdSense is a citizen civic-issue action platform for India. Its design philosophy balances **Institutional Civic Trust** (calm, authoritative, reliable) with **Consumer-Grade Usability** (Swiggy/Google Maps level speed and delight).

---

## 1. Color System

### Primary & Brand Colors
- **Brand Primary (`#0F172A`)**: Deep Slate Navy — conveys civic authority and institutional grounding.
- **Brand Vibrant Accent (`#2563EB`)**: Royal Blue — used for primary calls to action (CTAs), active tabs, and primary triggers.
- **Brand Sub-Accent (`#0284C7`)**: Sky Blue — secondary interactive highlights and active filter badges.

### Semantic Status Colors
Status colors are uniform across the Mobile App and Web Admin Dashboard:
- **Approved / Resolved (`#16A34A` Emerald)**: Background `#DCFCE7`, Border `#22C55E`
- **Pending / In Progress (`#D97706` Amber)**: Background `#FEF3C7`, Border `#F59E0B`
- **Rejected / Urgent (`#DC2626` Rose)**: Background `#FEE2E2`, Border `#EF4444`
- **Community Flagged (`#EA580C` Orange)**: Background `#FFEDD5`, Border `#F97316`
- **Women's Safety (`#DB2777` Pink)**: Background `#FCE7F3`, Border `#EC4899`
- **Utility Outage (`#059669` Teal)**: Background `#D1FAE5`, Border `#10B981`

---

## 2. Typography Scale (Indic & Devanagari Compatible)

Font sizes are calibrated to render cleanly across Devanagari, Tamil, Telugu, Kannada, Marathi, Bengali, and Latin scripts:
- **Display (`32px`, Bold)**: Hero titles, onboarding screens.
- **Heading 1 (`24px`, Bold)**: Screen header titles.
- **Heading 2 (`20px`, SemiBold)**: Card section headers, modal titles.
- **Heading 3 (`18px`, SemiBold)**: Sub-headers, drawer section titles.
- **Body Large (`16px`, Regular/Medium)**: Input text, primary list items.
- **Body Regular (`14px`, Regular)**: General description text, helper labels.
- **Caption / Badge (`12px`, Medium/Bold)**: Status chips, metadata tags, timestamps.

---

## 3. Spacing Grid (4/8/16/24/32/48px System)

- `space-1` (`4px`): Micro padding between icon and text label.
- `space-2` (`8px`): Inner component padding, chip gap.
- `space-3` (`12px`): Input field padding, compact card margins.
- `space-4` (`16px`): Default screen edge padding, standard component spacing.
- `space-6` (`24px`): Section gap, container margins.
- `space-8` (`32px`): Modal top padding, hero section gaps.
- `space-12` (`48px`): Top splash spacing, bottom bar clearance.

---

## 4. Minimum Touch Target Standard (WCAG 2.1 AA)

- **Touch Target Threshold**: Every interactive button, icon button, tab trigger, and checkbox MUST satisfy a minimum tap size of **44x44 pt/px**.
- **Icon + Label Pairing**: All primary navigation triggers pair recognizable icons with explicit text labels to serve users across literacy levels.

---

## 5. Elevation & Radius Scale

- **Radius**: `sm: 6px`, `md: 12px`, `lg: 16px`, `xl: 24px`, `full: 9999px`
- **Shadows**:
  - `low`: `{ shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 }`
  - `medium`: `{ shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 }`
  - `high`: `{ shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }`
