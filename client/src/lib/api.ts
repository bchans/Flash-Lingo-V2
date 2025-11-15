import { firebaseFunctionsAPI } from './firebase';

export async function getMistralTranslation(text: string, sourceLang: string, targetLang: string) {
  // Increment API call counter
  const currentCount = parseInt(localStorage.getItem('mistralAPICalls') || '0');
  localStorage.setItem('mistralAPICalls', (currentCount + 1).toString());

  try {
    return await firebaseFunctionsAPI.getMistralTranslation(text, sourceLang, targetLang);
  } catch (error) {
    console.error('Error fetching translation:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

export async function getGoogleTTSAudio(text: string, language: string): Promise<string> {
  // Increment TTS API call counter
  const currentCount = parseInt(localStorage.getItem('ttsAPICalls') || '0');
  localStorage.setItem('ttsAPICalls', (currentCount + 1).toString());

  try {
    const response = await fetch('/api/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, language }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 500 && errorData.requiresSetup) {
        throw new Error('TTS service requires configuration. Please set up your Google TTS credentials.');
      } else if (response.status === 401 && errorData.requiresSetup) {
        throw new Error('TTS authentication failed. Please check your credentials.');
      } else if (response.status === 403 && errorData.requiresSetup) {
        throw new Error('TTS permission denied. Please check your Google Cloud permissions.');
      } else if (response.status === 429) {
        throw new Error('TTS quota exceeded. Please wait before trying again.');
      } else {
        throw new Error(`TTS service error: ${errorData.error || 'Unknown error'}`);
      }
    }

    const audioBlob = await response.blob();
    
    // Check if the blob is actually audio data
    if (audioBlob.size === 0) {
      throw new Error('Empty audio response');
    }
    
    return URL.createObjectURL(audioBlob);
  } catch (error) {
    console.error('Error fetching TTS audio:', error);
    throw error;
  }
}

// Convert audio blob to base64 for storage
export async function audioToBase64(audioBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]); // Remove data URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });
}

// Convert base64 to audio blob
export function base64ToAudio(base64: string): string {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

// Get TTS statistics
export async function getTTSStats() {
  try {
    const response = await fetch('/api/tts-stats');
    if (!response.ok) {
      throw new Error('Failed to get TTS statistics');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching TTS stats:', error);
    return { totalCalls: 0 };
  }
}

// New Gemini API function for image processing and other tasks
export async function getGeminiResponse(prompt: string): Promise<string> {
  try {
    return await firebaseFunctionsAPI.getGeminiResponse(prompt);
  } catch (error) {
    console.error('Error fetching Gemini response:', error);
    throw error;
  }
}

// Test Firebase connection
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    return await firebaseFunctionsAPI.testConnection();
  } catch (error) {
    console.error('Error testing Firebase connection:', error);
    return false;
  }
}

export async function generateGrammarLesson(userCards: any[], sourceLang: string, targetLang: string, previousLessons: any[]): Promise<any> {
  try {
    return await firebaseFunctionsAPI.generateGrammarLesson({ userCards, sourceLang, targetLang, previousLessons });
  } catch (error) {
    console.error('Error generating grammar lesson:', error);
    throw error;
  }
}