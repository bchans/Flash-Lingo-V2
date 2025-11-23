// Import the functions you need from the SDKs you need
import { initializeApp, FirebaseApp, deleteApp, getApps } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getFunctions, httpsCallable, Functions } from "firebase/functions";
import { getFirebaseConfig } from './api-keys';

// Default Firebase configuration (will be overridden by stored config)
const defaultFirebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};

// Cached Firebase instances
let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let functions: Functions | null = null;
let lastConfigJson: string = "";

// Initialize Firebase with stored or default config
function initializeFirebase(): void {
  const storedConfig = getFirebaseConfig();
  const config = storedConfig || defaultFirebaseConfig;
  const configJson = JSON.stringify(config);
  
  // Check if we need to reinitialize (config changed)
  if (app && configJson === lastConfigJson) {
    return; // Already initialized with same config
  }
  
  // Delete existing app if config changed
  if (app && configJson !== lastConfigJson) {
    console.log('🔄 Firebase config changed, reinitializing...');
    deleteApp(app).catch(console.error);
    app = null;
    analytics = null;
    functions = null;
  }
  
  // Check if another instance exists (shouldn't happen, but just in case)
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
    console.log('📱 Using existing Firebase app');
  } else {
    if (!config.apiKey || !config.projectId) {
      console.warn('⚠️ Firebase not configured - missing apiKey or projectId');
      return;
    }
    
    console.log('🔥 Initializing Firebase with projectId:', config.projectId);
    app = initializeApp(config);
  }
  
  lastConfigJson = configJson;
  
  try {
    analytics = getAnalytics(app);
    functions = getFunctions(app);
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.warn('⚠️ Firebase services not fully initialized:', error);
  }
}

// Get Firebase app (lazy initialization)
function getFirebaseApp(): FirebaseApp | null {
  if (!app) {
    initializeFirebase();
  }
  return app;
}

// Get Firebase functions (lazy initialization)
function getFirebaseFunctions(): Functions | null {
  if (!functions) {
    initializeFirebase();
  }
  return functions;
}

// Firebase Functions API service using onCall
export class FirebaseFunctionsAPI {
  private static instance: FirebaseFunctionsAPI;

  static getInstance(): FirebaseFunctionsAPI {
    if (!FirebaseFunctionsAPI.instance) {
      FirebaseFunctionsAPI.instance = new FirebaseFunctionsAPI();
    }
    return FirebaseFunctionsAPI.instance;
  }

  async getMistralTranslation(text: string, sourceLang: string, targetLang: string): Promise<string> {
    const funcs = getFirebaseFunctions();
    if (!funcs) {
      throw new Error('Firebase not configured. Please add your Firebase config in Settings.');
    }
    
    // Increment API call counter
    const currentCount = parseInt(localStorage.getItem('mistralAPICalls') || '0');
    localStorage.setItem('mistralAPICalls', (currentCount + 1).toString());

    const getMistralTranslationCall = httpsCallable(funcs, 'getMistralTranslation');
    
    try {
      const result = await getMistralTranslationCall({ text, sourceLang, targetLang });
      const data = result.data as { translation: string; explanation: string; memoryAid: string };
      return data.translation;
    } catch (error) {
      console.error('Error calling getMistralTranslation:', error);
      throw error;
    }
  }

  async getGeminiResponse(prompt: string): Promise<string> {
    const funcs = getFirebaseFunctions();
    if (!funcs) {
      throw new Error('Firebase not configured. Please add your Firebase config in Settings.');
    }
    
    // Increment API call counter for image processing
    const currentCount = parseInt(localStorage.getItem('geminiAPICalls') || '0');
    localStorage.setItem('geminiAPICalls', (currentCount + 1).toString());

    const getGeminiResponseCall = httpsCallable(funcs, 'getGeminiResponse');
    
    try {
      const result = await getGeminiResponseCall({ prompt });
      const data = result.data as { response: string };
      return data.response;
    } catch (error) {
      console.error('Error calling getGeminiResponse:', error);
      throw error;
    }
  }

  async getGeminiTTS(text: string, languageCode: string, voiceName?: string): Promise<{ audioContent: string; languageCode: string; originalText: string }> {
    const funcs = getFirebaseFunctions();
    if (!funcs) {
      throw new Error('Firebase not configured. Please add your Firebase config in Settings.');
    }
    
    // Increment API call counter for TTS
    const currentCount = parseInt(localStorage.getItem('ttsAPICalls') || '0');
    localStorage.setItem('ttsAPICalls', (currentCount + 1).toString());

    const getGeminiTTSCall = httpsCallable(funcs, 'getGeminiTTS');
    
    try {
      const params = { text, languageCode, voiceName };
      console.log('Firebase TTS Call - Sending params:', params);
      const result = await getGeminiTTSCall(params);
      const data = result.data as { audioContent: string; languageCode: string; originalText: string };
      console.log('Firebase TTS Call - Success:', data);
      return data;
    } catch (error) {
      console.error('Error calling getGeminiTTS:', error);
      throw error;
    }
  }

  playBase64Audio(base64Audio: string): void {
    try {
      // Create a data URL from the base64 audio
      const audioDataUrl = `data:audio/mp3;base64,${base64Audio}`;
      
      // Create and play the audio
      const audio = new Audio(audioDataUrl);
      
      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        throw new Error('Failed to play audio');
      });
      
      audio.play().catch(error => {
        console.error('Audio play failed:', error);
        throw error;
      });
    } catch (error) {
      console.error('Error creating audio from base64:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test with a simple Gemini call
      const result = await this.getGeminiResponse('Hello, this is a test.');
      return result.length > 0;
    } catch (error) {
      console.error('Firebase connection test failed:', error);
      return false;
    }
  }

  async generateGrammarLesson(data: { userCards: any[]; sourceLang: string; targetLang: string; previousLessons: any[] }): Promise<any> {
    const funcs = getFirebaseFunctions();
    if (!funcs) {
      throw new Error('Firebase not configured. Please add your Firebase config in Settings.');
    }
    
    const generateGrammarLessonCall = httpsCallable(funcs, 'generateGrammarLesson');
    try {
      const result = await generateGrammarLessonCall(data);
      return result.data;
    } catch (error) {
      console.error('Error calling generateGrammarLesson:', error);
      throw error;
    }
  }
}

export const firebaseFunctionsAPI = FirebaseFunctionsAPI.getInstance();
export { getFirebaseApp, analytics, initializeFirebase };