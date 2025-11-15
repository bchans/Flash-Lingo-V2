import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Immediate console log to verify component is loaded
  console.log('🔧 InstallPrompt component mounted');

  useEffect(() => {
    // Enhanced debugging
    console.log('=== PWA INSTALL PROMPT DEBUG ===');
    console.log('1. Display mode:', window.matchMedia('(display-mode: standalone)').matches ? 'STANDALONE (Already installed)' : 'BROWSER');
    console.log('2. Service Worker support:', 'serviceWorker' in navigator ? 'YES' : 'NO');
    console.log('3. Current URL:', window.location.href);
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        console.log('4. Service Worker registered:', reg ? 'YES' : 'NO');
        if (reg) {
          console.log('   SW scope:', reg.scope);
          console.log('   SW state:', reg.active ? reg.active.state : 'no active worker');
        }
      });
    }

    const handler = (e: Event) => {
      console.log('✅ beforeinstallprompt event FIRED! Install is possible.');
      // Prevent the mini-infobar from appearing
      e.preventDefault();
      // Save the event so it can be triggered later
      setDeferredPrompt(e);
      // Show custom install button (unless user dismissed it)
      const dismissed = localStorage.getItem('installPromptDismissed');
      if (!dismissed) {
        setShowInstall(true);
        setDebugInfo('Install available');
        console.log('Install prompt captured and ready');
      } else {
        console.log('Install prompt was dismissed previously');
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isIOSStandalone = (window.navigator as any).standalone === true;
    
    if (isStandalone || (isIOS && isIOSStandalone)) {
      setShowInstall(false);
      setDebugInfo('Already installed');
      console.log('❌ App already installed as PWA - install prompt will not show');
    }

    // Debug timeout - if no event after 3 seconds
    setTimeout(() => {
      if (!deferredPrompt) {
        console.log('⚠️ No beforeinstallprompt event after 3 seconds. Possible reasons:');
        console.log('   - App is already installed (check chrome://apps)');
        console.log('   - User previously dismissed the prompt (Chrome remembers for ~3 months)');
        console.log('   - PWA criteria not met (check DevTools → Application → Manifest)');
        console.log('   - Service Worker not registered properly');
        setDebugInfo('Install not available - check console');
      }
    }, 3000);

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA was installed successfully');
      setShowInstall(false);
      setDeferredPrompt(null);
      localStorage.removeItem('installPromptDismissed');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.log('No install prompt available');
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowInstall(false);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setShowInstall(false);
    // Remember dismissal for 7 days
    localStorage.setItem('installPromptDismissed', Date.now().toString());
    
    // Clear the dismissal after 7 days
    setTimeout(() => {
      localStorage.removeItem('installPromptDismissed');
    }, 7 * 24 * 60 * 60 * 1000);
  };

  // Check if dismissal has expired (7 days)
  useEffect(() => {
    const dismissed = localStorage.getItem('installPromptDismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      if (dismissedTime < sevenDaysAgo) {
        // Dismissal expired, clear it
        localStorage.removeItem('installPromptDismissed');
        if (deferredPrompt) {
          setShowInstall(true);
        }
      } else {
        // Still within dismissal period
        setShowInstall(false);
      }
    }
  }, [deferredPrompt]);

  if (!showInstall || !deferredPrompt || isDismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-500">
      <div className="bg-primary text-primary-foreground rounded-lg shadow-lg p-4 max-w-sm relative">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 hover:bg-primary-foreground/10 rounded-full transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="pr-6">
          <h3 className="font-semibold mb-1">Install FlashLingo</h3>
          <p className="text-sm opacity-90 mb-3">
            Install this app for quick access and offline use!
          </p>
          
          <Button
            onClick={handleInstallClick}
            variant="secondary"
            className="w-full"
            size="sm"
          >
            <Download className="mr-2 h-4 w-4" />
            Install App
          </Button>
        </div>
      </div>
    </div>
  );
}

