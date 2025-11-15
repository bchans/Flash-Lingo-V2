
import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnlineStatusChange = () => {
      setIsOffline(!navigator.onLine);
    };

    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    window.addEventListener('connection-status-changed', 
      (e: CustomEvent) => setIsOffline(!e.detail.isOnline)
    );

    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
      window.removeEventListener('connection-status-changed', 
        handleOnlineStatusChange as EventListener
      );
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-4 left-4 bg-amber-500 text-white px-4 py-2 rounded-md shadow-lg z-50">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 bg-white rounded-full animate-pulse"></span>
        <span>You're offline. Some features may be limited.</span>
      </div>
    </div>
  );
}
