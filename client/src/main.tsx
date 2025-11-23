
import React from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./registerSW";

// Define Safari interface
interface SafariNavigator extends Navigator {
  standalone?: boolean;
}

// Diagnostics for PWA testing
const safariNavigator = window.navigator as SafariNavigator;
const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
              safariNavigator.standalone === true;
console.log(`App starting: PWA mode = ${isPWA ? 'YES' : 'NO'}`);
console.log(`Current URL: ${window.location.href}`);
console.log(`Origin: ${window.location.origin}`);

// Log startup context for debugging
console.log(`App initializing at path: ${window.location.pathname}`);

// Register service worker for PWA functionality
registerServiceWorker();

// Basic recovery for potential blank screens
try {
  // Store current path for recovery
  const currentPath = window.location.pathname;
  if (currentPath && currentPath !== '/') {
    console.log(`Saving current path (${currentPath}) for potential recovery`);
    sessionStorage.setItem('currentPath', currentPath);
  }
} catch (e) {
  console.error('Failed to setup path tracking:', e);
}

// Render with error boundary for PWA stability
try {
  // Simple render of root component
  const root = document.getElementById("root");
  if (root) {
    console.log('Rendering root component...');
    const base = import.meta.env.BASE_URL || '/';
    console.log('Router base path:', base);
    createRoot(root).render(
      <Router base={base}>
        <App />
      </Router>
    );
    console.log('Initial render complete');
  } else {
    console.error('Root element not found! DOM may not be ready.');
    // Add fallback to retry if root wasn't found
    setTimeout(() => {
      const rootRetry = document.getElementById("root");
      if (rootRetry && rootRetry.childElementCount === 0) {
        console.log('Retrying root component render...');
        const base = import.meta.env.BASE_URL || '/';
        createRoot(rootRetry).render(
          <Router base={base}>
            <App />
          </Router>
        );
      }
    }, 100);
  }
} catch (err) {
  console.error('Critical error during app initialization:', err);
  
  // Add recovery UI for catastrophic failures
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h2>Something went wrong</h2>
        <p>The app encountered an error during startup.</p>
        <button onclick="window.location.reload()">
          Reload App
        </button>
      </div>
    `;
  }
}
