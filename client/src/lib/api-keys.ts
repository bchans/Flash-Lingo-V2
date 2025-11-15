/**
 * API Keys Management System
 * Stores and retrieves API keys from localStorage
 */

export interface APIKeys {
  geminiApiKey: string;
  firebaseApiKey: string;
  mistralApiKey: string;
  firebaseConfig?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
}

const API_KEYS_STORAGE_KEY = 'flashlingo-api-keys';

// Default empty keys
const DEFAULT_KEYS: APIKeys = {
  geminiApiKey: '',
  firebaseApiKey: '',
  mistralApiKey: ''
};

/**
 * Get all stored API keys
 */
export function getAPIKeys(): APIKeys {
  try {
    const stored = localStorage.getItem(API_KEYS_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_KEYS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load API keys:', error);
  }
  return DEFAULT_KEYS;
}

/**
 * Save API keys to localStorage
 */
export function saveAPIKeys(keys: Partial<APIKeys>): void {
  try {
    const current = getAPIKeys();
    const updated = { ...current, ...keys };
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(updated));
    console.log('✅ API keys saved successfully');
  } catch (error) {
    console.error('Failed to save API keys:', error);
    throw error;
  }
}

/**
 * Check if API keys are configured
 */
export function hasAPIKeys(): boolean {
  const keys = getAPIKeys();
  return !!(keys.geminiApiKey || keys.firebaseApiKey || keys.mistralApiKey);
}

/**
 * Get specific API key
 */
export function getGeminiAPIKey(): string {
  return getAPIKeys().geminiApiKey;
}

export function getFirebaseAPIKey(): string {
  return getAPIKeys().firebaseApiKey;
}

export function getMistralAPIKey(): string {
  return getAPIKeys().mistralApiKey;
}

export function getFirebaseConfig() {
  return getAPIKeys().firebaseConfig;
}

/**
 * Clear all API keys
 */
export function clearAPIKeys(): void {
  localStorage.removeItem(API_KEYS_STORAGE_KEY);
  console.log('🗑️ API keys cleared');
}

/**
 * Export API keys as JSON string
 */
export function exportAPIKeys(): string {
  const keys = getAPIKeys();
  return JSON.stringify(keys, null, 2);
}

/**
 * Import API keys from JSON string
 */
export function importAPIKeys(jsonString: string): void {
  try {
    const keys = JSON.parse(jsonString);
    saveAPIKeys(keys);
    console.log('✅ API keys imported successfully');
  } catch (error) {
    console.error('Failed to import API keys:', error);
    throw new Error('Invalid API keys format');
  }
}

