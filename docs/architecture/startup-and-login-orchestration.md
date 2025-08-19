---
description: Story Collection app startup, auth, loader, and onboarding orchestration (new vs returning users)
---

# Startup and Login Orchestration

This document traces the exact order of operations and interactions among scripts, the loader, auth guard, bootstrap, SSE, and onboarding modal on `chat.html`. It highlights where races can cause the chat to appear before the loader or onboarding.

## Page Structure and Script Load Order

File: `chat.html`

- Body starts with `hidden` attribute: `<body hidden>`
- Loader overlay exists at top of body with `id="app-loader"` and `z-index: 9999`
- Script order (relevant):
  1. `js/auth-guard.js` (non-module, in `<head>`) — runs immediately
  2. `/env.js` and `js/config.js`
  3. `js/crypto-utils.js`
  4. `js/firebase-config.js` (`type="module"`) — sets up Firebase and dispatches `firebase-ready`
  5. At end of `<body>`: `js/onboarding.js`, `js/app-header.js`, `js/app.js`

## Auth Guard

File: `js/auth-guard.js`

- Immediately adds `document.documentElement.classList.add('auth-guard') ` to prevent paint.
- Defines `reveal()` which removes `auth-guard` class and sets `document.body.hidden = false`.
- Subscribes to `window.firebaseAuth.onAuthStateChanged` once Firebase is ready via `firebase-ready` event.
- Behavior:
  - On user present: cancel pending redirect and `reveal()`.
  - On user null: schedules redirect to `index.html` after 600ms (debounced), allowing persisted sessions time to restore.
  - Fallbacks if Firebase never initializes (4s timeout) or no auth events (1.2s watchdog).

Implication: The auth guard is designed to keep the page hidden until authenticated, then reveal.

## Firebase Initialization

File: `js/firebase-config.js`

- Initializes Firebase app and auth.
- Exposes `window.firebaseAuth` with helpers and callback APIs.
- Calls `onAuthStateChanged` and immediately invokes registered callbacks with current user (possibly `null`).
- Calls `onIdTokenChanged` for token rotations.
- Dispatches `window.dispatchEvent(new Event('firebase-ready'))` when ready.

## App Bootstrap Orchestration

File: `js/app.js`

- On `DOMContentLoaded`:
  - Logs and initializes UI (`initializeInput()`, `initializeButtons()`, `initializeModelSelector()`, `initializeDebugPanel()`)
  - Calls `setupAuthSSEBinding()` (bind SSE lifecycle to Firebase token changes)
  - Sets `bootstrapInProgress = true`
  - IMPORTANT: `document.body.removeAttribute('hidden')` is called here, then `showAppLoader()` displays the overlay.
  - Calls `await bootstrapApp()`
  - Initializes collapsible memory sections and memory count observers

- `showAppLoader()` / `hideAppLoader()` toggle `#app-loader` display.

- `bootstrapApp()` sequence:
  1. `await waitForSecureStorage()`
  2. `const sessionRestored = await loadSecureSession()`
     - If a saved session exists, restores messages/memories and calls `restoreSessionUI()`.
  3. `await waitForAuthReady()` then, if authenticated, forces a fresh ID token `getIdToken(true)`
  4. Prefetch durable narrator name via `getUserPreference('narrator_name')`
  5. Compute `isNewUserFlag` (not shown here, but stored globally) based on:
     - `sessionRestored`, localStorage markers (`story-collection-used`, `story_session_exists`), messages/memories presence, validated name.
  6. `hideAppLoader()`, set `bootstrapInProgress = false`, dispatch `app-bootstrap-complete`
  7. `await autoStartConversation()` to decide new vs returning greeting

- `restoreSessionUI()`:
  - Renders any restored messages and updates memory display.
  - Logs `[onboarding] restoreSessionUI summary` and only shows `showContinuationPrompt()` if:
    - Not bootstrapping AND
    - There are memories AND
    - `isNewUserFlag === false`

- `autoStartConversation()`:
  - Ensures narrator name is available (queries preference if needed).
  - Decides user status using `isNewUserFlag` or heuristics (name/memories/messages/session marker/splash marker).
  - If new: schedules `startInitialConversation()` after 600ms.
  - If returning: delays `showContinuationPrompt()` until `memoryHydrated` or a short polling timeout.

## SSE and Memory Hydration

- `setupAuthSSEBinding()` (in `js/app.js`): initializes/re-initializes EventSource when tokens change.
- SSE emits memory events to hydrate the memory panel; sets `memoryHydrated = true` when complete (searched by name; flag is used by onboarding delay logic).

## Onboarding Modal

File: `js/onboarding.js`

- Exposes `window.showPostLoginOnboarding(user)` used by `auth-ui` after successful login.
- Auto-binds to `firebaseAuth.onAuthStateChanged`; on first authenticated user it calls `showPostLoginOnboarding` unless dismissed via localStorage or server preference.
- If the loader is active, it waits for `app-bootstrap-complete`, then shows the modal with a small delay.

## Expected Timeline

- Initial navigation to `chat.html`:
  1. `auth-guard.js` adds `auth-guard` class; body is also `hidden` via markup.
  2. `firebase-config.js` initializes, sets `window.firebaseAuth`, dispatches `firebase-ready`.
  3. `auth-guard` binds `onAuthStateChanged`. If user exists, `reveal()` (removes `auth-guard`, sets `body.hidden=false`). If user null, schedule redirect after 600ms.
  4. `DOMContentLoaded` in `app.js`:
     - Calls `document.body.removeAttribute('hidden')` (forces body visible regardless of auth state).
     - Calls `showAppLoader()` (overlay should appear on top of the content).
     - Starts `bootstrapApp()` which performs session restore, auth readiness, name fetch, and sets `isNewUserFlag`.
     - Hides loader and dispatches `app-bootstrap-complete`, then `autoStartConversation()` decides which message to show.
  5. `onboarding.js` may show the onboarding modal after bootstrap (if not dismissed), waiting for `app-bootstrap-complete` when loader was active.

## Observed Issue: Chat showing before Loader/Modal

- Root cause candidate: In `js/app.js` `DOMContentLoaded` handler, `document.body.removeAttribute('hidden')` is executed unconditionally before auth guard confirms auth. This can:
  - Reveal the page content earlier than `auth-guard` intends.
  - Allow chat UI to render momentarily before `showAppLoader()` (even though both happen in the same tick, rendering order/paint can vary), causing perceived flash.
- Because `auth-guard` uses a CSS class on `<html>` and the body `hidden` attribute, removing `hidden` in app.js weakens its guarantee.
- The onboarding modal is designed to appear after `app-bootstrap-complete` if loader was active, so any early reveal before loader can result in “chat visible before loader/modal.”

## New vs Returning User Branching (for reference)

- New user (detected): `startInitialConversation()` adds a personalized or generic greeting and marks `story_session_exists`.
- Returning user: `showContinuationPrompt()` summarizes memory counts and asks to continue; display is delayed until `memoryHydrated` to avoid premature canned prompts.

## Signals and Flags

- `bootstrapInProgress` (global): true during bootstrap to prevent early UI prompts.
- `memoryHydrated` (global): true after SSE completes initial hydration.
- `isNewUserFlag` (global): computed once during bootstrap to stabilize onboarding decisions.
- LocalStorage markers:
  - `story-collection-used`: whether user came from splash.
  - `story_session_exists`: set after first initial conversation.

## Potential Race Points

- Unconditional `body.removeAttribute('hidden')` in `app.js` vs. `auth-guard` reveal logic.
- Immediate `restoreSessionUI()` during `loadSecureSession()` may render messages behind the loader; this is intended, but if loader isn’t shown yet, chat may appear.
- Onboarding modal waits for `app-bootstrap-complete` when loader is active; if loader was not active (e.g., due to early body reveal), modal might appear later than the first paint of chat.

## Next Diagnostic Steps (No Code Changes Yet)

- Add temporary timestamped logs at the very start of each of these points to confirm ordering in the browser console:
  - `auth-guard.js`: before/after adding `auth-guard`, in `reveal()`, when scheduling redirect, and on auth events.
  - `firebase-config.js`: right before dispatching `firebase-ready`, and in `onAuthStateChanged` first invocation.
  - `app.js` (`DOMContentLoaded`): before removing `hidden`, before/after `showAppLoader()`, entering `bootstrapApp()`, and before `hideAppLoader()`.
  - `onboarding.js`: when `showPostLoginOnboarding` is invoked, whether it is waiting for `app-bootstrap-complete`.

This will pinpoint exactly where the early paint occurs in your environment.
