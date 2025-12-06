import React, { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import Home from "@/pages/home";
import Create from "@/pages/create";
import Scan from "@/pages/scan";
import Study from "@/pages/study";
import Stats from "@/pages/stats";
import MyCards from "@/pages/my-cards";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { LanguageOnboarding } from "@/components/ui/language-onboarding";
import { usePreferences } from "@/lib/preferences-simple";
import { AchievementProvider } from "@/lib/achievement-context";
import { APIKeysProvider } from "@/lib/api-keys-context";
import { AchievementNotification } from "@/components/ui/achievement-notification";
import { InstallPrompt } from "@/components/ui/install-prompt";
import { getLanguageLabel } from "@/lib/constants";
import { useMemo } from "react";

// 404 Page
function NotFound() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-2">404 Not Found</h1>
      <p className="text-center text-muted-foreground">
        The page you're looking for doesn't exist.
      </p>
    </div>
  );
}

// Main App component
function App() {
  const hasCompletedOnboarding = usePreferences(state => state.hasCompletedOnboarding);
  const languages = usePreferences(state => state.languages);
  const [location] = useLocation();
  
  // Debug logging for routing
  useEffect(() => {
    console.log('🔍 Route changed to:', location);
    console.log('🔍 Full URL:', window.location.href);
    console.log('🔍 Pathname:', window.location.pathname);
    console.log('🔍 Onboarding completed:', hasCompletedOnboarding);
  }, [location, hasCompletedOnboarding]);
  
  // Update document title based on selected language
  useEffect(() => {
    if (languages?.learningLang) {
      const learningLanguageLabel = getLanguageLabel(languages.learningLang);
      document.title = `FlashCards - Learn ${learningLanguageLabel}`;
    }
  }, [languages?.learningLang]);

  // Save current path for recovery
  useEffect(() => {
    const currentPath = window.location.pathname;
    sessionStorage.setItem('currentPath', currentPath);
    console.log('Saved current path:', currentPath);
  }, []);

  // Try to recover path on mount
  useEffect(() => {
    const savedPath = sessionStorage.getItem('currentPath');
    if (savedPath && savedPath !== '/' && window.location.pathname === '/') {
      console.log('Recovering from path:', savedPath);
      try {
        window.history.replaceState(null, '', savedPath);
      } catch (e) {
        console.error('Path recovery failed:', e);
      }
    }
  }, []);

  const AppContent = useMemo(() => (
    <>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/create" component={Create} />
        <Route path="/scan" component={Scan} />
        <Route path="/study" component={Study} />
        <Route path="/study/:mode" component={Study} />
        <Route path="/stats" component={Stats} />
        <Route path="/my-cards" component={MyCards} />
        <Route component={NotFound} />
      </Switch>
      
      <OfflineIndicator />
      <AchievementNotification />
      <InstallPrompt />
    </>
  ), [location]);

  // Show onboarding if needed
  if (!hasCompletedOnboarding) {
    console.log('🎯 APP: Showing onboarding screen');
    return (
      <>
        <LanguageOnboarding />
        <InstallPrompt />
      </>
    );
  }

  console.log('🎯 APP: Onboarding complete, rendering main app');
  console.log('🎯 APP: Current location from wouter:', location);
  console.log('🎯 APP: Languages:', languages);
  
  return (
    <APIKeysProvider>
      <AchievementProvider>
        <div className="min-h-screen bg-background">
          {console.log('🎯 APP: Rendering Switch component')}
          {AppContent}
        </div>
      </AchievementProvider>
    </APIKeysProvider>
  );
}

export default App;