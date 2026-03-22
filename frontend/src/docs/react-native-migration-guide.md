# DentaFlow AI — React Native Migration Guide

## Overview

The DentaFlow AI web frontend was architected for portable business logic. ~80% of the codebase (hooks, services, stores, types, constants) can be copied directly into a React Native project.

## What Stays Identical (Copy Unchanged)

| Layer | Files | Notes |
|-------|-------|-------|
| **Types** | `modules/*/types/*.ts` | Pure TypeScript interfaces |
| **Services** | `modules/*/services/*.ts` | Axios works in RN (or swap to fetch) |
| **Store** | `modules/*/store/*.ts` | Zustand API is identical in RN |
| **Constants** | `constants/*.ts` | Pure JS/TS values |
| **Hooks** (marked REACT NATIVE READY) | Various `hooks/*.ts` | No DOM dependencies |
| **TanStack Query** | `lib/queryClient.ts` | Same API, same config |

## What Changes for React Native

| Web | React Native Replacement | Effort |
|-----|--------------------------|--------|
| `react-router-dom` | `@react-navigation/native` + stack/tab navigators | Medium |
| `axios` (web) | `axios` (same) or RN `fetch` | Low |
| `localStorage` | `@react-native-async-storage/async-storage` | Low |
| Tailwind CSS | `nativewind` or `StyleSheet.create` | High |
| `framer-motion` | `react-native-reanimated` | Medium |
| `<input type="file">` | `expo-document-picker` + `expo-image-picker` | Medium |
| Radix UI components | Custom RN components or `react-native-paper` | High |

## What Needs RN-Specific Implementation

### 3D Dental Viewer
- **Web**: React Three Fiber (`@react-three/fiber`)
- **RN**: `expo-gl` + `expo-three` or `react-native-gl-model-view`
- This is the most complex component to port. Consider a WebView-based fallback initially.
- Estimated effort: 40-60 hours

### Tooth Instruction Panel (Dental Chart SVG)
- **Web**: HTML/CSS dental arch diagram
- **RN**: `react-native-svg` with same path data
- Estimated effort: 8-12 hours

### File Upload
- **Web**: `<input type="file">` + drag-and-drop
- **RN**: `expo-document-picker` (STL files) + `expo-image-picker` (photos)
- Estimated effort: 4-6 hours

### Push Notifications
- **Web**: Web Push API + VAPID
- **RN**: `expo-notifications` + FCM/APNs
- Estimated effort: 8-12 hours

### Offline Storage
- **Web**: Service Worker + Cache API
- **RN**: `@react-native-async-storage/async-storage` + `expo-file-system`
- Estimated effort: 6-8 hours

## Estimated Port Effort by Module

| Module | Copy-Paste | Needs Porting | Total Hours |
|--------|-----------|---------------|-------------|
| **Auth** | hooks, services, store, types | LoginPage, RegisterPage UI | 8-12h |
| **Cases** | hooks, services, types | CasesListPage, CaseDetailPage, NewCasePage UI | 16-24h |
| **Treatment/3D** | services, types | TreatmentViewer, TreatmentScene (full rewrite) | 40-60h |
| **Tooth Instructions** | hooks, types | ToothInstructionPanel (SVG rewrite) | 8-12h |
| **Billing** | services, types | BillingDashboard, PricingPage UI | 8-12h |
| **Notifications** | services, types | NotificationBell → RN equivalent | 4-6h |
| **Admin/Analytics** | services, types | AnalyticsPage UI | 6-8h |
| **Navigation** | — | Full rewrite with React Navigation | 8-12h |
| **Total** | | | **~100-150h** |

## Quick Start for RN Project

1. `npx create-expo-app dentaflow-mobile --template blank-typescript`
2. Copy `src/constants/`, `src/types/`, `src/lib/api.ts`, `src/lib/queryClient.ts`
3. Copy all `modules/*/types/`, `modules/*/services/`, `modules/*/store/`
4. Copy hooks marked "REACT NATIVE READY"
5. Install: `zustand`, `@tanstack/react-query`, `axios`, `@react-native-async-storage/async-storage`
6. Set up React Navigation (stack + bottom tabs)
7. Build RN-specific UI components
