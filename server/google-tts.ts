import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { z } from 'zod';

const textToSpeechRequestSchema = z.object({
  text: z.string(),
  language: z.string(),
});

// Voice mapping for different languages
const VOICE_MAPPING: Record<string, { languageCode: string; name: string }> = {
  'en': { languageCode: 'en-US', name: 'en-US-Wavenet-D' },
  'es': { languageCode: 'es-ES', name: 'es-ES-Wavenet-B' },
  'fr': { languageCode: 'fr-FR', name: 'fr-FR-Wavenet-B' },
  'de': { languageCode: 'de-DE', name: 'de-DE-Wavenet-B' },
  'it': { languageCode: 'it-IT', name: 'it-IT-Wavenet-B' },
  'pt': { languageCode: 'pt-BR', name: 'pt-BR-Wavenet-B' },
  'ru': { languageCode: 'ru-RU', name: 'ru-RU-Wavenet-B' },
  'ja': { languageCode: 'ja-JP', name: 'ja-JP-Wavenet-B' },
  'ko': { languageCode: 'ko-KR', name: 'ko-KR-Wavenet-B' },
  'zh': { languageCode: 'zh-CN', name: 'zh-CN-Wavenet-B' },
  'hi': { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-B' },
  'ar': { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-B' },
  'th': { languageCode: 'th-TH', name: 'th-TH-Wavenet-B' },
  'vi': { languageCode: 'vi-VN', name: 'vi-VN-Wavenet-B' },
  'tr': { languageCode: 'tr-TR', name: 'tr-TR-Wavenet-B' },
  'pl': { languageCode: 'pl-PL', name: 'pl-PL-Wavenet-B' },
  'nl': { languageCode: 'nl-NL', name: 'nl-NL-Wavenet-B' },
  'sv': { languageCode: 'sv-SE', name: 'sv-SE-Wavenet-A' },
  'da': { languageCode: 'da-DK', name: 'da-DK-Wavenet-A' },
  'no': { languageCode: 'nb-NO', name: 'nb-NO-Wavenet-A' },
  'fi': { languageCode: 'fi-FI', name: 'fi-FI-Wavenet-A' },
  'cs': { languageCode: 'cs-CZ', name: 'cs-CZ-Wavenet-A' },
  'hu': { languageCode: 'hu-HU', name: 'hu-HU-Wavenet-A' },
  'ro': { languageCode: 'ro-RO', name: 'ro-RO-Wavenet-A' },
  'bg': { languageCode: 'bg-BG', name: 'bg-BG-Wavenet-A' },
  'hr': { languageCode: 'hr-HR', name: 'hr-HR-Wavenet-A' },
  'sl': { languageCode: 'sl-SI', name: 'sl-SI-Wavenet-A' },
  'sk': { languageCode: 'sk-SK', name: 'sk-SK-Wavenet-A' },
  'et': { languageCode: 'et-EE', name: 'et-EE-Wavenet-A' },
  'lv': { languageCode: 'lv-LV', name: 'lv-LV-Wavenet-A' },
  'lt': { languageCode: 'lt-LT', name: 'lt-LT-Wavenet-A' },
  'mt': { languageCode: 'mt-MT', name: 'mt-MT-Wavenet-A' },
  'ga': { languageCode: 'ga-IE', name: 'ga-IE-Wavenet-A' },
  'cy': { languageCode: 'cy-GB', name: 'cy-GB-Wavenet-A' },
  'is': { languageCode: 'is-IS', name: 'is-IS-Wavenet-A' },
  'mk': { languageCode: 'mk-MK', name: 'mk-MK-Wavenet-A' },
  'sq': { languageCode: 'sq-AL', name: 'sq-AL-Wavenet-A' },
  'bs': { languageCode: 'bs-BA', name: 'bs-BA-Wavenet-A' },
  'sr': { languageCode: 'sr-RS', name: 'sr-RS-Wavenet-A' },
  'me': { languageCode: 'me-ME', name: 'me-ME-Wavenet-A' },
  'ms': { languageCode: 'ms-MY', name: 'ms-MY-Wavenet-A' },
  'id': { languageCode: 'id-ID', name: 'id-ID-Wavenet-A' },
  'tl': { languageCode: 'tl-PH', name: 'tl-PH-Wavenet-A' },
  'sw': { languageCode: 'sw-KE', name: 'sw-KE-Wavenet-A' },
  'zu': { languageCode: 'zu-ZA', name: 'zu-ZA-Wavenet-A' },
  'xh': { languageCode: 'xh-ZA', name: 'xh-ZA-Wavenet-A' },
  'af': { languageCode: 'af-ZA', name: 'af-ZA-Wavenet-A' },
  'am': { languageCode: 'am-ET', name: 'am-ET-Wavenet-A' },
  'he': { languageCode: 'he-IL', name: 'he-IL-Wavenet-A' },
  'fa': { languageCode: 'fa-IR', name: 'fa-IR-Wavenet-A' },
  'ur': { languageCode: 'ur-PK', name: 'ur-PK-Wavenet-A' },
  'bn': { languageCode: 'bn-BD', name: 'bn-BD-Wavenet-A' },
  'gu': { languageCode: 'gu-IN', name: 'gu-IN-Wavenet-A' },
  'kn': { languageCode: 'kn-IN', name: 'kn-IN-Wavenet-A' },
  'ml': { languageCode: 'ml-IN', name: 'ml-IN-Wavenet-A' },
  'mr': { languageCode: 'mr-IN', name: 'mr-IN-Wavenet-A' },
  'ta': { languageCode: 'ta-IN', name: 'ta-IN-Wavenet-A' },
  'te': { languageCode: 'te-IN', name: 'te-IN-Wavenet-A' },
  'pa': { languageCode: 'pa-IN', name: 'pa-IN-Wavenet-A' },
  'ne': { languageCode: 'ne-NP', name: 'ne-NP-Wavenet-A' },
  'si': { languageCode: 'si-LK', name: 'si-LK-Wavenet-A' },
  'my': { languageCode: 'my-MM', name: 'my-MM-Wavenet-A' },
  'km': { languageCode: 'km-KH', name: 'km-KH-Wavenet-A' },
  'lo': { languageCode: 'lo-LA', name: 'lo-LA-Wavenet-A' },
  'ka': { languageCode: 'ka-GE', name: 'ka-GE-Wavenet-A' },
  'hy': { languageCode: 'hy-AM', name: 'hy-AM-Wavenet-A' },
  'az': { languageCode: 'az-AZ', name: 'az-AZ-Wavenet-A' },
  'kk': { languageCode: 'kk-KZ', name: 'kk-KZ-Wavenet-A' },
  'ky': { languageCode: 'ky-KG', name: 'ky-KG-Wavenet-A' },
  'uz': { languageCode: 'uz-UZ', name: 'uz-UZ-Wavenet-A' },
  'tg': { languageCode: 'tg-TJ', name: 'tg-TJ-Wavenet-A' },
  'mn': { languageCode: 'mn-MN', name: 'mn-MN-Wavenet-A' },
  'eu': { languageCode: 'eu-ES', name: 'eu-ES-Wavenet-A' },
  'ca': { languageCode: 'ca-ES', name: 'ca-ES-Wavenet-A' },
  'gl': { languageCode: 'gl-ES', name: 'gl-ES-Wavenet-A' },
  'lb': { languageCode: 'lb-LU', name: 'lb-LU-Wavenet-A' },
  'rm': { languageCode: 'rm-CH', name: 'rm-CH-Wavenet-A' },
  'co': { languageCode: 'co-FR', name: 'co-FR-Wavenet-A' },
  'br': { languageCode: 'br-FR', name: 'br-FR-Wavenet-A' },
  'oc': { languageCode: 'oc-FR', name: 'oc-FR-Wavenet-A' },
  'sc': { languageCode: 'sc-IT', name: 'sc-IT-Wavenet-A' },
  'nap': { languageCode: 'nap-IT', name: 'nap-IT-Wavenet-A' },
  'vec': { languageCode: 'vec-IT', name: 'vec-IT-Wavenet-A' },
  'lij': { languageCode: 'lij-IT', name: 'lij-IT-Wavenet-A' },
  'pms': { languageCode: 'pms-IT', name: 'pms-IT-Wavenet-A' },
  'lmo': { languageCode: 'lmo-IT', name: 'lmo-IT-Wavenet-A' },
  'fur': { languageCode: 'fur-IT', name: 'fur-IT-Wavenet-A' },
  'lld': { languageCode: 'lld-IT', name: 'lld-IT-Wavenet-A' },
  'roa-tara': { languageCode: 'roa-tara-IT', name: 'roa-tara-IT-Wavenet-A' },
  'eml': { languageCode: 'eml-IT', name: 'eml-IT-Wavenet-A' },
  'rgn': { languageCode: 'rgn-IT', name: 'rgn-IT-Wavenet-A' },
  'scn': { languageCode: 'scn-IT', name: 'scn-IT-Wavenet-A' },
};

// Initialize the client - it will be configured when credentials are provided
let ttsClient: TextToSpeechClient | null = null;

export function initializeTTSClient(credentials: any) {
  try {
    ttsClient = new TextToSpeechClient({
      credentials: credentials,
      projectId: credentials.project_id,
    });
    return true;
  } catch (error) {
    console.error('Failed to initialize TTS client:', error);
    return false;
  }
}

export async function googleTextToSpeechHandler(req: any, res: any) {
  try {
    const { text, language } = textToSpeechRequestSchema.parse(req.body);
    
    if (!ttsClient) {
      return res.status(500).json({ 
        error: 'Google TTS service not configured',
        requiresSetup: true 
      });
    }

    // Get voice configuration for the language
    const voiceConfig = VOICE_MAPPING[language] || VOICE_MAPPING['en'];
    
    // Construct the request
    const request = {
      input: { text },
      voice: {
        languageCode: voiceConfig.languageCode,
        name: voiceConfig.name,
      },
      audioConfig: {
        audioEncoding: 'MP3' as const,
        speakingRate: 1.0,
        pitch: 0.0,
      },
    };

    // Perform the text-to-speech request
    const [response] = await ttsClient.synthesizeSpeech(request);
    
    if (!response.audioContent) {
      throw new Error('No audio content received');
    }

    // Increment TTS API call counter
    const currentCount = parseInt(process.env.TTS_API_CALLS || '0');
    process.env.TTS_API_CALLS = (currentCount + 1).toString();
    
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', response.audioContent.length);
    res.send(response.audioContent);
  } catch (error) {
    console.error('Google TTS Error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else if (error.code === 'UNAUTHENTICATED') {
      res.status(401).json({ 
        error: 'Authentication failed',
        requiresSetup: true 
      });
    } else if (error.code === 'PERMISSION_DENIED') {
      res.status(403).json({ 
        error: 'Permission denied',
        requiresSetup: true 
      });
    } else if (error.code === 'QUOTA_EXCEEDED') {
      res.status(429).json({ 
        error: 'Quota exceeded',
        details: 'API usage limit reached'
      });
    } else {
      res.status(500).json({ 
        error: 'Text-to-speech service error',
        details: error.message || 'Unknown error'
      });
    }
  }
}