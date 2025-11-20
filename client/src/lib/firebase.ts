// Import the functions you need from the SDKs you need
import { initializeApp, FirebaseApp } from "firebase/app";
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

// Initialize Firebase with stored or default config
function getFirebaseApp(): FirebaseApp {
  const storedConfig = getFirebaseConfig();
  const config = storedConfig || defaultFirebaseConfig;
  
  if (!config.apiKey) {
    console.warn('Firebase API key not configured');
  }
  
  return initializeApp(config);
}

const app = getFirebaseApp();
let analytics: Analytics | null = null;
let functions: Functions | null = null;

try {
  analytics = getAnalytics(app);
  functions = getFunctions(app);
} catch (error) {
  console.warn('Firebase services not fully initialized:', error);
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
    if (!functions) {
      throw new Error('Firebase not configured. Please add your Firebase config in Settings.');
    }
    
    // Increment API call counter
    const currentCount = parseInt(localStorage.getItem('mistralAPICalls') || '0');
    localStorage.setItem('mistralAPICalls', (currentCount + 1).toString());

    const getMistralTranslationCall = httpsCallable(functions, 'getMistralTranslation');
    
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
    if (!functions) {
      throw new Error('Firebase not configured. Please add your Firebase config in Settings.');
    }
    
    // Increment API call counter for image processing
    const currentCount = parseInt(localStorage.getItem('geminiAPICalls') || '0');
    localStorage.setItem('geminiAPICalls', (currentCount + 1).toString());

    const getGeminiResponseCall = httpsCallable(functions, 'getGeminiResponse');
    
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
    if (!functions) {
      throw new Error('Firebase not configured. Please add your Firebase config in Settings.');
    }
    
    // Increment API call counter for TTS
    const currentCount = parseInt(localStorage.getItem('ttsAPICalls') || '0');
    localStorage.setItem('ttsAPICalls', (currentCount + 1).toString());

    const getGeminiTTSCall = httpsCallable(functions, 'getGeminiTTS');
    
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
    if (!functions) {
      throw new Error('Firebase not configured. Please add your Firebase config in Settings.');
    }
    
    const generateGrammarLessonCall = httpsCallable(functions, 'generateGrammarLesson');
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
export { app, analytics };