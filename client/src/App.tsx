import React, { useEffect } from "react";
import { Switch, Route } from "wouter";
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
import { AchievementNotification } from "@/components/ui/achievement-notification";
import { InstallPrompt } from "@/components/ui/install-prompt";
import { getLanguageLabel } from "@/lib/constants";

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

  // Show onboarding if needed
  if (!hasCompletedOnboarding) {
    return (
      <>
        <LanguageOnboarding />
        <InstallPrompt />
      </>
    );
  }

  return (
    <AchievementProvider>
      <div className="min-h-screen bg-background">
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
      </div>
    </AchievementProvider>
  );
}

export default App;