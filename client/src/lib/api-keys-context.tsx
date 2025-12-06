/**
 * API Keys Context
 * Provides global state management for API keys and easy access to import functionality
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAPIKeys, saveAPIKeys, importAPIKeys, getMistralAPIKey, getGeminiAPIKey } from './api-keys';

interface APIKeysContextType {
  hasMistralKey: boolean;
  hasGeminiKey: boolean;
  hasAnyKey: boolean;
  isImportDialogOpen: boolean;
  openImportDialog: () => void;
  closeImportDialog: () => void;
  refreshKeys: () => void;
  importKeysFromFile: () => Promise<boolean>;
}

const APIKeysContext = createContext<APIKeysContextType | null>(null);

export function APIKeysProvider({ children }: { children: React.ReactNode }) {
  const [hasMistralKey, setHasMistralKey] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const refreshKeys = useCallback(() => {
    const mistralKey = getMistralAPIKey();
    const geminiKey = getGeminiAPIKey();
    setHasMistralKey(!!mistralKey && mistralKey.length > 0);
    setHasGeminiKey(!!geminiKey && geminiKey.length > 0);
  }, []);

  useEffect(() => {
    refreshKeys();
    
    // Listen for storage changes (in case keys are updated in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'flashlingo-api-keys') {
        refreshKeys();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshKeys]);

  const openImportDialog = useCallback(() => {
    setIsImportDialogOpen(true);
  }, []);

  const closeImportDialog = useCallback(() => {
    setIsImportDialogOpen(false);
    refreshKeys();
  }, [refreshKeys]);

  const importKeysFromFile = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          try {
            const text = await file.text();
            importAPIKeys(text);
            refreshKeys();
            resolve(true);
          } catch (error) {
            console.error('Failed to import API keys:', error);
            resolve(false);
          }
        } else {
          resolve(false);
        }
      };
      input.oncancel = () => resolve(false);
      input.click();
    });
  }, [refreshKeys]);

  const value: APIKeysContextType = {
    hasMistralKey,
    hasGeminiKey,
    hasAnyKey: hasMistralKey || hasGeminiKey,
    isImportDialogOpen,
    openImportDialog,
    closeImportDialog,
    refreshKeys,
    importKeysFromFile,
  };

  return (
    <APIKeysContext.Provider value={value}>
      {children}
    </APIKeysContext.Provider>
  );
}

export function useAPIKeys() {
  const context = useContext(APIKeysContext);
  if (!context) {
    throw new Error('useAPIKeys must be used within an APIKeysProvider');
  }
  return context;
}

/**
 * Hook to check if a specific API key is available and provide import functionality
 */
export function useRequireAPIKey(keyType: 'mistral' | 'gemini') {
  const { hasMistralKey, hasGeminiKey, importKeysFromFile, openImportDialog } = useAPIKeys();
  
  const hasKey = keyType === 'mistral' ? hasMistralKey : hasGeminiKey;
  
  return {
    hasKey,
    importKeys: importKeysFromFile,
    openSettings: openImportDialog,
  };
}

