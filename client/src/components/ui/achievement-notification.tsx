import React, { useEffect, useState } from 'react';
import { useAchievement } from '@/lib/achievement-context';
import { X } from 'lucide-react';

// Helper to get base path-aware asset URLs
const getAssetUrl = (path: string) => {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path}`.replace(/\/\//g, '/');
};

export function AchievementNotification() {
  const { currentAchievement, hideAchievement } = useAchievement();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (currentAchievement) {
      // Reset progress when new achievement appears
      setProgress(0);
      
      // Start progress animation immediately with smooth continuous progress
      const startTime = Date.now();
      const duration = 4000; // 4 seconds for smooth animation
      
      const animateProgress = () => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min((elapsed / duration) * 100, 100);
        setProgress(newProgress);
        
        if (newProgress < 100) {
          requestAnimationFrame(animateProgress);
        } else {
          // Auto-hide when progress bar completes
          setTimeout(() => {
            hideAchievement();
          }, 200); // Small delay to ensure progress bar is fully visible
        }
      };
      
      // Start animation immediately
      requestAnimationFrame(animateProgress);
    }
  }, [currentAchievement, hideAchievement]);

  if (!currentAchievement) return null;

  return (
    <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 animate-in slide-in-from-bottom-10 duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg overflow-hidden border border-slate-200 dark:border-slate-800 w-[340px]">
        <div className="flex items-start p-4">
          <div className="flex-shrink-0 mr-3">
            <img 
              src={getAssetUrl("success-clippy.png")} 
              alt="Clippy Achievement" 
              className="h-14 w-14 object-contain"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Achievement Unlocked!
              </h3>
              <button 
                onClick={hideAchievement}
                className="ml-4 inline-flex text-slate-400 hover:text-slate-500 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1">
              <p className="text-sm font-medium text-primary">{currentAchievement.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {currentAchievement.description}
              </p>
            </div>
          </div>
        </div>
        <div className="h-1 bg-slate-200 dark:bg-slate-700">
          <div 
            className="h-full bg-primary transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}