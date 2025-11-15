import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePreferences } from '@/lib/preferences-simple';

type Achievement = {
  id: string;
  name: string;
  description: string;
};

type AchievementContextType = {
  showAchievement: (achievement: Achievement) => void;
  currentAchievement: Achievement | null;
  hideAchievement: () => void;
};

const AchievementContext = createContext<AchievementContextType | undefined>(undefined);

export function AchievementProvider({ children }: { children: ReactNode }) {
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [achievementQueue, setAchievementQueue] = useState<Achievement[]>([]);
  
  // Get the notification setting from the preferences store
  const { showAchievementNotifications } = usePreferences();

  // Keep track of shown achievements in localStorage
  const [shownAchievements, setShownAchievements] = useState<Set<string>>(() => {
    // Initialize from localStorage
    try {
      const stored = localStorage.getItem('shownAchievements');
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch (error) {
      console.error('Failed to parse shownAchievements from localStorage', error);
      return new Set<string>();
    }
  });

  // Process next achievement in queue
  const processNextAchievement = () => {
    if (achievementQueue.length > 0) {
      const nextAchievement = achievementQueue[0];
      setCurrentAchievement(nextAchievement);
      setAchievementQueue(prev => prev.slice(1));
      
      // Mark this achievement as shown permanently
      setShownAchievements(prev => {
        const updated = new Set(prev);
        updated.add(nextAchievement.id);
        // Save to localStorage
        localStorage.setItem('shownAchievements', JSON.stringify(Array.from(updated)));
        return updated;
      });
      
      // Don't auto-hide here - let the progress bar handle it
      // setTimeout(() => {
      //   setCurrentAchievement(null);
      //   // Check if there are more achievements to show after a small delay
      //   setTimeout(processNextAchievement, 500);
      // }, 5000);
    }
  };

  const showAchievement = (achievement: Achievement) => {
    // Only show notifications if enabled in user preferences
    if (!showAchievementNotifications) return;
    
    // If this achievement has been previously shown, don't show it again
    if (shownAchievements.has(achievement.id)) {
      return;
    }
    
    if (!currentAchievement) {
      setCurrentAchievement(achievement);
      
      // Mark this achievement as shown permanently
      setShownAchievements(prev => {
        const updated = new Set(prev);
        updated.add(achievement.id);
        // Save to localStorage
        localStorage.setItem('shownAchievements', JSON.stringify(Array.from(updated)));
        return updated;
      });
      
      // Don't auto-hide here - let the progress bar handle it
      // setTimeout(() => {
      //   setCurrentAchievement(null);
      //   setTimeout(processNextAchievement, 500);
      // }, 5000);
    } else {
      setAchievementQueue(prev => [...prev, achievement]);
    }
  };

  const hideAchievement = () => {
    setCurrentAchievement(null);
    // Process next achievement in queue after hiding current one
    setTimeout(processNextAchievement, 500);
  };

  return (
    <AchievementContext.Provider value={{ showAchievement, currentAchievement, hideAchievement }}>
      {children}
    </AchievementContext.Provider>
  );
}

export function useAchievement() {
  const context = useContext(AchievementContext);
  if (context === undefined) {
    throw new Error('useAchievement must be used within an AchievementProvider');
  }
  return context;
}