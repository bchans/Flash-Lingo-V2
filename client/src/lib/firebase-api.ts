import { firebaseFunctionsAPI } from './firebase';

// Firebase-based API service - now using onCall functions
export class FirebaseAPIService {
  private static instance: FirebaseAPIService;

  static getInstance(): FirebaseAPIService {
    if (!FirebaseAPIService.instance) {
      FirebaseAPIService.instance = new FirebaseAPIService();
    }
    return FirebaseAPIService.instance;
  }

  async getMistralTranslation(text: string, sourceLang: string, targetLang: string): Promise<string> {
    return firebaseFunctionsAPI.getMistralTranslation(text, sourceLang, targetLang);
  }

  async getGeminiResponse(prompt: string): Promise<string> {
    return firebaseFunctionsAPI.getGeminiResponse(prompt);
  }

  async getGeminiTTS(text: string, languageCode: string, voiceName?: string): Promise<{ audioContent: string; languageCode: string; originalText: string }> {
    return firebaseFunctionsAPI.getGeminiTTS(text, languageCode, voiceName);
  }

  playBase64Audio(base64Audio: string): void {
    return firebaseFunctionsAPI.playBase64Audio(base64Audio);
  }

  async testFirebaseConnection(): Promise<boolean> {
    return firebaseFunctionsAPI.testConnection();
  }

  async generateGrammarLesson(data: { userCards: any[]; sourceLang: string; targetLang: string; previousLessons: any[] }): Promise<any> {
    return firebaseFunctionsAPI.generateGrammarLesson(data);
  }
}

export const firebaseAPI = FirebaseAPIService.getInstance();