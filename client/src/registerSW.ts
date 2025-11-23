
// Define interface for Safari's standalone property
interface SafariNavigator extends Navigator {
  standalone?: boolean;
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    // Handle PWA events
    window.addEventListener('appinstalled', (event) => {
      console.log('PWA was installed to home screen');
      // Track installation event if needed
    });

    // Handle page visibility for PWA recovery
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // When the page becomes visible (PWA reopened), check for blank screens
        setTimeout(() => {
          const appRoot = document.getElementById('root');
          const hasContent = appRoot && appRoot.children.length > 0;
          
          if (!hasContent) {
            console.log('App in blank state after visibility change, refreshing');
            window.location.reload();
          }
        }, 1000);
      }
    });

    // Try to register the service worker immediately without waiting for load event
    registerSW();

    // Also register on load as a fallback
    window.addEventListener('load', () => {
      // Make sure service worker is registered
      registerSW();
      
      // Add an event listener to detect when the page is about to be unloaded
      // This helps with page refresh scenarios
      window.addEventListener('beforeunload', () => {
        // Store the current path so we can restore it on reload
        sessionStorage.setItem('lastPath', window.location.pathname);
      });
      
      // Check if we're reloading from a sub-route and need to restore
      const lastPath = sessionStorage.getItem('lastPath');
      const currentPath = window.location.pathname;
      
      if (lastPath && lastPath !== '/' && currentPath === '/') {
        // We've been redirected to root - try to restore the previous path
        console.log('Detecting page reload, restoring path:', lastPath);
        try {
          // Use a short delay to ensure app is ready to handle the navigation
          setTimeout(() => {
            window.history.replaceState(null, '', lastPath);
            console.log('Path restored to:', lastPath);
            
            // Clear the stored path to prevent unwanted redirects
            sessionStorage.removeItem('lastPath');
          }, 200); // Slight increase in delay to ensure app is ready
        } catch (e) {
          console.error('Failed to restore path:', e);
        }
      }
      
      // Listen for messages from the service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SAVE_PATH') {
          // Save the current path for recovery
          const path = event.data.path;
          if (path && path !== '/') {
            console.log('Service worker requested path save:', path);
            sessionStorage.setItem('currentPath', path);
          }
        } else if (event.data && event.data.type === 'SW_ACTIVATED') {
          // Service worker was activated
          console.log(`Service worker activated with cache: ${event.data.cache}`);
          
          // Check the DOM state after activation
          setTimeout(() => {
            const appRoot = document.getElementById('root');
            const hasContent = appRoot && appRoot.children.length > 0;
            
            if (!hasContent) {
              console.log('App appears to be in a blank state after SW activation, refreshing');
              window.location.reload();
            }
          }, 1000);
        }
      });

      // Check for blank screen immediately after load
      setTimeout(() => {
        const appRoot = document.getElementById('root');
        const hasContent = appRoot && appRoot.children.length > 0;
        
        if (!hasContent) {
          console.log('App failed to render content after initial load, refreshing');
          window.location.reload();
        }
      }, 3000); // Give the app 3 seconds to render after initial load
    });

    // Setup app restart checks when going back online
    window.addEventListener('online', () => {
      updateOnlineStatus();
      
      // Wait a moment to make sure connections are stable
      setTimeout(() => {
        // Check if the app is in a "stuck" state by seeing if key UI elements exist
        const appRoot = document.getElementById('root');
        const hasContent = appRoot && appRoot.children.length > 0;
        
        if (!hasContent) {
          console.log('App appears to be in a blank state, attempting recovery');
          window.location.reload();
        }
      }, 2000);
    });
    
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus(); // Check initial status
    
    // Periodically check if the app is responsive (more frequent for PWA stability)
    setInterval(() => {
      // Simple health check - see if the root element has content
      const appRoot = document.getElementById('root');
      const hasContent = appRoot && appRoot.children.length > 0;
      
      if (!hasContent) {
        console.log('App health check failed - blank screen detected, reloading');
        
        // Check if this is a standalone PWA
        const safariNavigator = window.navigator as SafariNavigator;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
          || safariNavigator.standalone === true;
        
        if (isStandalone) {
          console.log('Detected standalone mode (PWA), doing hard reload');
          window.location.href = '/'; // Force to home in PWA mode for recovery
        } else {
          window.location.reload(); // Standard reload for browser
        }
      }
    }, 15000); // Check more frequently - every 15 seconds
  }
}

async function registerSW() {
  try {
    // Get the base path from Vite configuration
    const basePath = import.meta.env.BASE_URL || '/';
    const swPath = `${basePath}sw.js`.replace(/\/\//g, '/'); // Remove double slashes
    
    const registration = await navigator.serviceWorker.register(swPath, { 
      // This enables the service worker to control pages immediately
      updateViaCache: 'none'
    });

    console.log('Service Worker registered with scope:', registration.scope);

    // Handle Service Worker updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      console.log('Service Worker update found!');
      
      newWorker.addEventListener('statechange', () => {
        // When the service worker is installed, we can notify the user to reload
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            console.log('New Service Worker installed, refresh recommended');
            
            // Check for app updates every few minutes
            setTimeout(() => {
              registration.update().catch(err => {
                console.warn('Service Worker update check failed:', err);
              });
            }, 5 * 60 * 1000); // 5 minutes
          }
        }
      });
    });

    // Check for updates
    setInterval(() => {
      registration.update().catch(err => {
        console.warn('Service Worker periodic update check failed:', err);
      });
    }, 60 * 60 * 1000); // Check for updates every hour
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    
    // If registration fails, retry after a short delay
    setTimeout(() => {
      console.log('Retrying Service Worker registration...');
      registerSW().catch(err => 
        console.error('Service Worker registration retry failed:', err)
      );
    }, 3000);
  }
}

function updateOnlineStatus() {
  const isOnline = navigator.onLine;
  document.body.dataset.online = isOnline.toString();
  
  // Store online status in localStorage
  localStorage.setItem('isOnline', isOnline.toString());
  
  // Dispatch event for components to listen to
  window.dispatchEvent(new CustomEvent('connection-status-changed', { 
    detail: { isOnline } 
  }));
  
  // If we're coming back online, trigger a service worker update check
  if (isOnline && navigator.serviceWorker.controller) {
    console.log('Back online - checking for service worker updates');
    navigator.serviceWorker.ready.then(registration => 
      registration.update()
    ).catch(err => console.warn('Update check failed:', err));
  }
}
