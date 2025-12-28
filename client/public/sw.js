// Maximum aggressive caching Service Worker for FlashLingo
// This will cache EVERYTHING from our origin for offline use

const CACHE_NAME = 'flashlingo-v20';
const BASE_PATH = '/Flash-Lingo-V2';

// The main assets to precache (only files that actually exist)
const PRECACHE_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/offline.html`,
  `${BASE_PATH}/icon.svg`,
  `${BASE_PATH}/icon-192.svg`,
  `${BASE_PATH}/icon-512.svg`,
  `${BASE_PATH}/clippy_working.png`,
  `${BASE_PATH}/success-clippy.png`,
  `${BASE_PATH}/clippy-french-flag.png`,
  `${BASE_PATH}/clippy-vietnamese-flag.png`,
  `${BASE_PATH}/clippy-german-flag.png`,
  `${BASE_PATH}/clippy-italian-flag.png`,
  `${BASE_PATH}/clippy-japanese-flag.png`,
  `${BASE_PATH}/clippy-korean-flag.png`,
  `${BASE_PATH}/clippy-portugese-flag.png`,
  `${BASE_PATH}/clippy-spanish-flag.png`,
  `${BASE_PATH}/clippy-USA-flag.png`,
  `${BASE_PATH}/clippy-chinese-flag.png`,
  `${BASE_PATH}/clippy-russian-flag.png`,
  // Driving game assets
  `${BASE_PATH}/car.glb`,
  `${BASE_PATH}/car2.glb`,
  `${BASE_PATH}/car3.glb`,
  `${BASE_PATH}/car4.glb`,
  `${BASE_PATH}/car5.glb`,
  `${BASE_PATH}/car6.glb`,
  `${BASE_PATH}/skybox.png`,
  `${BASE_PATH}/kenney_car_palette.png`,
  `${BASE_PATH}/driving-game-intro.png`,
  `${BASE_PATH}/clouds/cloud1.png`,
  `${BASE_PATH}/clouds/cloud2.png`,
  `${BASE_PATH}/clouds/cloud3.png`,
  `${BASE_PATH}/clouds/cloud4.png`
];

// SPA routes for our app (relative to BASE_PATH)
const APP_ROUTES = [
  '',
  '/create',
  '/study', 
  '/study/flashcard',
  '/study/multiple-choice',
  '/study/streak',
  '/study/daily',
  '/study/driving-game',
  '/study/time-attack',
  '/stats',
  '/my-cards',
  '/achievements'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing and caching static assets');

  // Skip waiting so the new service worker activates immediately
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // First cache the static assets
      return cache.addAll(PRECACHE_ASSETS)
        .then(() => {
          console.log('Service Worker: Static assets cached successfully');

          // Then cache all SPA routes with index.html content
          return fetch(`${BASE_PATH}/index.html`).then(response => {
            const indexHtml = response.clone();

            // Promise for caching all routes
            const routePromises = APP_ROUTES.map(route => {
              return cache.put(new Request(`${BASE_PATH}${route}`), indexHtml.clone());
            });

            return Promise.all(routePromises);
          });
        })
        .catch(error => {
          console.error('Service Worker: Failed to cache assets:', error);
        });
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating');

  // Immediately claim clients to ensure PWA is controlled by this service worker
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Now ready to handle fetches');
      
      // Actively claim any existing clients
      return self.clients.claim().then(() => {
        // After claiming clients, check if any need initialization
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => {
            // Notify each client that the service worker is ready
            client.postMessage({
              type: 'SW_ACTIVATED',
              cache: CACHE_NAME
            });
          });
        });
      });
    })
  );
});

// Aggressively cache any newly accessed resources
function cacheResource(request, response) {
  if (response && response.status === 200) {
    const responseToCache = response.clone();

    caches.open(CACHE_NAME).then(cache => {
      cache.put(request, responseToCache);
    }).catch(error => {
      console.error('Failed to cache resource:', error);
    });
  }
  return response;
}

// Fetch event - super aggressive caching
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle requests to our own origin
  if (url.origin !== location.origin) {
    // For external requests (like API calls), let the browser handle them normally
    return;
  }

  // Special handling for navigation requests (app routes)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Check if this is an app route
          const path = url.pathname;
          
          console.log('Service Worker: Handling navigation to:', path);
          
          // Save the current path to sessionStorage for recovery purposes
          try {
            const clients = await self.clients.matchAll({type: 'window'});
            if (clients && clients.length > 0) {
              // Create a message to tell the client to save the current path
              clients[0].postMessage({
                type: 'SAVE_PATH',
                path: path
              });
            }
          } catch (e) {
            console.error('Failed to save path:', e);
          }
          
          // First, check if this is the root path or one of our explicit SPA routes
          // Strip BASE_PATH from the beginning of path to match against APP_ROUTES
          const relativePath = path.startsWith(BASE_PATH) ? path.substring(BASE_PATH.length) : path;
          
          if (relativePath === '' || relativePath === '/' || APP_ROUTES.includes(relativePath)) {
            console.log('Service Worker: Known route detected, serving index.html for:', path);
            const indexResponse = await caches.match(`${BASE_PATH}/index.html`);
            if (indexResponse) return indexResponse;
          }
          
          // Check for dynamic routes like /study/something
          // For example, /study/flashcard should match /study/:mode
          const maybeAppRoute = APP_ROUTES.some(route => {
            // Skip routes that don't have parameters
            if (!route.includes(':')) {
              // Check if the current path is a child of a known route
              // For example, /Flash-Lingo-V2/study/custom-mode is a child of /study
              const fullRoute = `${BASE_PATH}${route}`;
              return path.startsWith(fullRoute + '/') || path === fullRoute || relativePath.startsWith(route + '/') || relativePath === route;
            }
            
            // For routes with parameters, like /study/:mode
            const routeParts = route.split('/');
            const pathParts = relativePath.split('/');
            
            // Routes must have the same number of parts
            if (routeParts.length !== pathParts.length) return false;
            
            // Each part must either match exactly or be a parameter (starting with :)
            return routeParts.every((part, i) => 
              part.startsWith(':') || part === pathParts[i]
            );
          });
          
          // If we identified this as an app route, serve index.html
          if (maybeAppRoute) {
            console.log('Service Worker: SPA route detected (from patterns), serving index.html for:', path);
            const indexResponse = await caches.match(`${BASE_PATH}/index.html`);
            if (indexResponse) return indexResponse;
          }
          
          // For all other navigation requests, try:
          // 1. The exact cached response
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            console.log('Service Worker: Found', path, 'in cache');
            return cachedResponse;
          }
          
          // 2. Network request
          try {
            console.log('Service Worker: Fetching', path, 'from network');
            const networkResponse = await fetch(event.request);
            
            // Cache the response for next time
            return cacheResource(event.request, networkResponse);
          } catch (networkError) {
            console.error('Network fetch failed for navigation:', networkError);
            
            // 3. As a last resort for SPA-like paths, return index.html
            // This helps with refresh on deep links
            if ((path.startsWith(BASE_PATH) || path.startsWith('/')) && path.split('/').length >= 2) {
              console.log('Service Worker: Network failed, assuming SPA route:', path);
              const indexResponse = await caches.match(`${BASE_PATH}/index.html`);
              if (indexResponse) return indexResponse;
            }
            
            // 4. Last resort - offline page
            throw networkError; // will be caught by outer try/catch
          }
        } catch (error) {
          console.error('Service Worker: Navigation error for', url.pathname, ':', error);
          
          // If everything fails, try to serve index.html for SPA navigation
          console.log('Service Worker: Falling back to index.html');
          try {
            const indexResponse = await caches.match(`${BASE_PATH}/index.html`);
            if (indexResponse) return indexResponse;
          } catch (e) {
            console.error('Failed to serve index.html fallback:', e);
          }
          
          // If even that fails, serve offline page with recovery info
          console.log('Service Worker: Final fallback to offline.html');
          try {
            const offlineResponse = await caches.match(`${BASE_PATH}/offline.html`);
            if (offlineResponse) {
              // Add recovery url parameter so offline page knows to attempt recovery
              const offlineUrl = new URL(`${BASE_PATH}/offline.html`, self.location.origin);
              offlineUrl.searchParams.set('recovery', 'true');
              offlineUrl.searchParams.set('from', url.pathname);
              
              const modifiedRequest = new Request(offlineUrl);
              return offlineResponse;
            }
          } catch (e) {
            console.error('Failed to serve offline.html fallback:', e);
          }
          
          // Nothing worked, create a minimal response
          return new Response(
            '<html><body><h1>Offline</h1><p>The app is currently offline.</p></body></html>',
            {
              status: 503,
              headers: {'Content-Type': 'text/html'}
            }
          );
        }
      })()
    );
    return;
  }

  // For all other requests (assets, API calls, etc.)
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // If we have a cached version, use it
      if (cachedResponse) {
        // Also fetch a fresh copy for next time (in background)
        fetch(event.request)
          .then(response => cacheResource(event.request, response))
          .catch(() => console.log('Background fetch failed, using cached version'));

        return cachedResponse;
      }

      // If not in cache yet, get from network and cache it
      return fetch(event.request)
        .then(response => cacheResource(event.request, response))
        .catch(error => {
          console.error('Fetch failed:', error);

          // For assets, use an appropriate fallback
          const accept = event.request.headers.get('Accept') || '';

          if (accept.includes('image')) {
            // For images, return a blank image
            return new Response('', {
              status: 200,
              headers: {'Content-Type': 'image/svg+xml'}
            });
          }

          if (accept.includes('text/css')) {
            // For CSS, return empty stylesheet
            return new Response('', {
              status: 200,
              headers: {'Content-Type': 'text/css'}
            });
          }

          if (accept.includes('application/javascript')) {
            // For JS, return empty script
            return new Response('', {
              status: 200,
              headers: {'Content-Type': 'application/javascript'}
            });
          }

          // Generic fallback
          return new Response('Resource not available offline', {
            status: 503,
            headers: {'Content-Type': 'text/plain'}
          });
        });
    })
  );
});