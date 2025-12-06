import type { TranslationRequest } from '@shared/schema';
import { LANGUAGES } from './constants';
import { getMistralAPIKey } from './api-keys';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

// Helper function to get the full language name from the language code
function getFullLanguageName(code: string): string {
  const language = LANGUAGES.find(lang => lang.value === code);
  if (!language) {
    console.warn(`Language code ${code} not found, defaulting to English`);
    return 'English';
  }
  // Extract just the language name without the flag emoji
  return language.label.split(' ')[1];
}

export async function getMemoryAid({ text, translation, sourceLang, targetLang, memoryAidType = 'random' }: { text: string, translation: string, sourceLang: string, targetLang: string, memoryAidType?: string }) {
  // Check API key
  const apiKey = getMistralAPIKey();
  if (!apiKey) {
    throw new Error('Mistral API key not configured. Please add your API key in Settings.');
  }
  
  // Get full language names for better memory aid quality
  const sourceLanguageFull = getFullLanguageName(sourceLang);
  const targetLanguageFull = getFullLanguageName(targetLang);

  // Handle random selection
  let actualType = memoryAidType;
  if (memoryAidType === 'random') {
    const availableTypes = ['visual', 'acronym', 'rhyme', 'phonetic'];
    actualType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
  }

  const getPromptForType = (type: string) => {
    const baseInfo = `${text} = ${translation}`;

    switch (type) {
      case 'acronym':
        return `Create an acronym-based memory aid for the ${targetLanguageFull} word "${translation}" (meaning "${text}" in ${sourceLanguageFull}): ${baseInfo}
Focus on creating a memorable acronym using concepts, actions, or objects related to the meaning of "${text}" but DO NOT use the word "${translation}" itself in the acronym. Use related concepts, synonyms, or associations instead. Make it catchy and easy to remember. Keep it to a maximum of two sentences.
YOUR RESPONSE MUST START WITH EXACTLY: "Acronym: " followed by the memory aid.
DO NOT include any additional text, explanations, or formatting.`;

      case 'rhyme':
        return `Create a rhyme-based memory aid for the ${targetLanguageFull} word "${translation}" (meaning "${text}" in ${sourceLanguageFull}): ${baseInfo}
Focus on creating a simple rhyme or rhythmic phrase that helps remember the ${targetLanguageFull} word and its meaning. Make it catchy and fun. Keep it to a maximum of two sentences.
YOUR RESPONSE MUST START WITH EXACTLY: "Rhyme: " followed by the memory aid.
DO NOT include any additional text, explanations, or formatting.`;

      case 'visual':
        return `Create a visual association memory aid for the ${targetLanguageFull} word "${translation}" (meaning "${text}" in ${sourceLanguageFull}): ${baseInfo}
Focus on visual imagery and mental pictures that help remember the ${targetLanguageFull} word. Keep it to a maximum of two sentences.
YOUR RESPONSE MUST START WITH EXACTLY: "Visual: " followed by the memory aid.
DO NOT include any additional text, explanations, or formatting.`;

      case 'phonetic':
        return `Create a phonetic memory aid for the ${targetLanguageFull} word "${translation}" (meaning "${text}" in ${sourceLanguageFull}): ${baseInfo}
Focus on sound similarities, rhymes, or phonetic connections with the ${targetLanguageFull} word. Keep it to a maximum of two sentences.
YOUR RESPONSE MUST START WITH EXACTLY: "Phonetic: " followed by the memory aid.
DO NOT include any additional text, explanations, or formatting.`;

      default: // fallback to visual
        return `Create a visual association memory aid for the ${targetLanguageFull} word "${translation}" (meaning "${text}" in ${sourceLanguageFull}): ${baseInfo}
Focus on visual imagery and mental pictures that help remember the ${targetLanguageFull} word. Keep it to a maximum of two sentences.
YOUR RESPONSE MUST START WITH EXACTLY: "Visual: " followed by the memory aid.
DO NOT include any additional text, explanations, or formatting.`;
    }
  };

  const prompt = getPromptForType(actualType);

  try {
    // Track Mistral API usage
    const currentAPICalls = parseInt(localStorage.getItem('mistralAPICalls') || '0');
    localStorage.setItem('mistralAPICalls', (currentAPICalls + 1).toString());
    
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getMistralAPIKey()}`
      },
      body: JSON.stringify({
        model: "mistral-medium-2505",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid or expired Mistral API key. Please check your API key in Settings.');
      } else if (response.status === 429) {
        throw new Error('API rate limit exceeded. Please wait a moment and try again.');
      } else if (response.status >= 500) {
        throw new Error('Mistral AI service is temporarily unavailable. Please try again later.');
      }
      throw new Error(`Memory aid request failed (${response.status}). Please try again.`);
    }

    const data = await response.json();
    const result = data.choices[0].message.content;
    
    // Parse response to extract memory aid based on type
    let memoryAid = '';
    const prefixes = ['Acronym:', 'Rhyme:', 'Visual:', 'Phonetic:'];
    
    for (const prefix of prefixes) {
      if (result && result.startsWith(prefix)) {
        memoryAid = result.replace(prefix, '').trim();
        break;
      }
    }
    
    // Fallback if no prefix found
    if (!memoryAid && result) {
      memoryAid = result.trim();
    }
    
    return memoryAid;
  } catch (error) {
    throw new Error('Failed to get memory aid: ' + (error as Error).message);
  }
}

export async function getCategoryForCard(sourceText: string, targetText: string, type: string) {
  // Check API key
  const apiKey = getMistralAPIKey();
  if (!apiKey) {
    throw new Error('Mistral API key not configured. Please add your API key in Settings.');
  }
  
  try {
    const prompt = `Categorize this language learning card into a logical category with an emoji.

Card: "${sourceText}" = "${targetText}" (Type: ${type})

Provide a broad, intuitive category like "Animals", "Food", "Colors", "Family", "Transportation", etc.

Respond with a JSON object in this exact format:
{
  "category": "Animals",
  "categoryEmoji": "🐾"
}

IMPORTANT: Respond ONLY with valid JSON, no additional text or explanations.`;

    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getMistralAPIKey()}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in Mistral response');
    }

    // Clean the content to extract JSON from markdown code blocks
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const categoryData = JSON.parse(cleanContent);
    return categoryData;
  } catch (error) {
    console.error('Error getting category:', error);
    // Return default category if API fails
    return {
      category: "General",
      categoryEmoji: "📝"
    };
  }
}

export async function getTranslation({ text, sourceLang, targetLang }: TranslationRequest, feedback?: string) {
  // Check API key
  const apiKey = getMistralAPIKey();
  if (!apiKey) {
    throw new Error('Mistral API key not configured. Please add your API key in Settings.');
  }
  
  // Get full language names for better translation quality
  const sourceLanguageFull = getFullLanguageName(sourceLang);
  const targetLanguageFull = getFullLanguageName(targetLang);
  
  console.log(`Translating from ${sourceLanguageFull} (${sourceLang}) to ${targetLanguageFull} (${targetLang})`);
  
  const prompt = feedback 
    ? `You previously translated the text "${text}" from ${sourceLanguageFull} to ${targetLanguageFull}.
       A user has provided this feedback on your translation: "${feedback}"
       
       Please provide an improved translation based on this feedback.
       
       YOUR RESPONSE MUST START WITH EXACTLY: "Translation: " followed by the translation and nothing else.
       
       THEN AFTER ONE BLANK LINE, YOUR RESPONSE MUST CONTINUE WITH EXACTLY: "Mnemonic: " followed by a short memory hook.
       
       DO NOT include any additional text, explanations, or formatting.`
    : `You are a translator for ${sourceLanguageFull} to ${targetLanguageFull}.
       
       Translate this ${sourceLanguageFull} text: "${text}"
       
       YOUR RESPONSE MUST START WITH EXACTLY: "Translation: " followed by ONLY the translated text.
       
       THEN AFTER ONE BLANK LINE, YOUR RESPONSE MUST CONTINUE WITH EXACTLY: "Mnemonic: " followed by a short memory hook in ${sourceLanguageFull}.
       
       DO NOT include any additional text, explanations, or formatting.`;

  try {
    // Track Mistral API usage
    const currentAPICalls = parseInt(localStorage.getItem('mistralAPICalls') || '0');
    localStorage.setItem('mistralAPICalls', (currentAPICalls + 1).toString());
    
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getMistralAPIKey()}`
      },
      body: JSON.stringify({
        model: "mistral-medium-2505",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid or expired Mistral API key. Please check your API key in Settings.');
      } else if (response.status === 429) {
        throw new Error('API rate limit exceeded. Please wait a moment and try again.');
      } else if (response.status >= 500) {
        throw new Error('Mistral AI service is temporarily unavailable. Please try again later.');
      }
      throw new Error(`Translation request failed (${response.status}). Please try again.`);
    }

    const data = await response.json();
    const result = data.choices[0].message.content;

    // Parse response to extract translation and explanation
    const parts = result.split('\n\n');
    
    // Get translation from first part
    let translation = '';
    if (parts[0] && parts[0].startsWith('Translation:')) {
      translation = parts[0].replace('Translation:', '').trim();
    }
    
    // Get mnemonic from second part
    let explanation = '';
    if (parts[1] && parts[1].startsWith('Mnemonic:')) {
      explanation = parts[1].replace('Mnemonic:', '').trim();
    }
    
    return {
      translation,
      explanation
    };
  } catch (error) {
    throw new Error('Failed to get translation: ' + (error as Error).message);
  }
}