// Auth Guard for chat.html
// Adds a pre-render guard to prevent unauthenticated users from seeing the chat page
// Redirects to index.html if not authenticated; reveals page when authenticated

(function() {
  try {
    // Add guard immediately to prevent paint
    document.documentElement.classList.add('auth-guard');
    if (window.console && console.log) console.log('[guard] install @', Date.now());
  } catch (_) {}

  function reveal() {
    try {
      // Ensure loader is visible on first paint
      const loader = document.getElementById('app-loader');
      if (loader) loader.style.display = 'flex';
    } catch (_) {}
    try { document.documentElement.classList.remove('auth-guard'); } catch (_) {}
    try { if (document.body) document.body.hidden = false; } catch (_) {}
    try {
      // Signal to the app that the page has been revealed
      window.dispatchEvent(new Event('page-revealed'));
      // Optional debug log
      if (window.console && console.log) console.log('[guard] page-revealed @', Date.now());
    } catch (_) {}
  }

  function redirectToLogin() {
    try { window.location.replace('index.html'); } catch (_) { window.location.href = 'index.html'; }
  }

  // Debounced redirect to avoid racing Firebase session restoration
  let pendingRedirectTimer = null;
  function scheduleRedirect(delayMs) {
    if (pendingRedirectTimer) return; // already scheduled
    if (window.console && console.log) console.log('[guard] scheduleRedirect', delayMs, '@', Date.now());
    pendingRedirectTimer = setTimeout(() => {
      redirectToLogin();
    }, delayMs);
  }
  function cancelRedirect() {
    if (pendingRedirectTimer) {
      clearTimeout(pendingRedirectTimer);
      pendingRedirectTimer = null;
    }
  }

  // If Firebase is already available, bind immediately
  function bindAuthGate() {
    const auth = window.firebaseAuth;
    if (!auth) {
      // Fail-closed if auth unavailable
      redirectToLogin();
      return;
    }
    let sawFirstAuthEvent = false;
    auth.onAuthStateChanged(function(user) {
      sawFirstAuthEvent = true;
      if (window.console && console.log) console.log('[guard] onAuthStateChanged user=', !!user, '@', Date.now());
      if (user) {
        cancelRedirect();
        reveal();
      } else {
        // Give Firebase a brief window to restore persisted session before redirecting
        // This prevents a false redirect for already-authenticated users on initial load
        scheduleRedirect(600);
      }
    });

    // As an extra safeguard, if we haven't seen any auth event shortly after ready, schedule redirect
    setTimeout(() => {
      if (!sawFirstAuthEvent) scheduleRedirect(0);
    }, 1200);
  }

  if (window.firebaseAuth) {
    bindAuthGate();
  } else {
    // Wait for firebase-config to signal readiness
    window.addEventListener('firebase-ready', bindAuthGate, { once: true });
    // Safety timeout: if Firebase never initializes, fail-closed
    setTimeout(() => {
      if (!window.firebaseAuth) redirectToLogin();
    }, 4000);
  }
})();
