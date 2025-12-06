// Gemini AI integration for image-based flashcard extraction
// the newest Gemini model is "gemini-1.5-pro" which supports vision and text processing

import { getGeminiAPIKey } from './api-keys';

interface GeminiTranslationRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
  extractionType?: string;
}

interface GeminiImageRequest {
  imageData: string;
  sourceLang: string;
  targetLang: string;
  extractionType?: string;
}

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";

function getFullLanguageName(code: string): string {
  const languageMap: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'vi': 'Vietnamese'
  };
  return languageMap[code] || 'English';
}

function repairTruncatedJSON(content: string): string {
  let repairedContent = content.trim();
  
  // For scenario responses, look for the scenarios array pattern
  if (repairedContent.includes('"scenarios":[')) {
    // Find the last complete scenario object
    const scenarioMatches = repairedContent.match(/\{[^}]*"scenarioTheme"[^}]*\}/g);
    if (scenarioMatches && scenarioMatches.length > 0) {
      const lastCompleteScenario = scenarioMatches[scenarioMatches.length - 1];
      const lastScenarioIndex = repairedContent.lastIndexOf(lastCompleteScenario);
      const endIndex = lastScenarioIndex + lastCompleteScenario.length;
      
      // Truncate to last complete scenario and close the structure
      repairedContent = repairedContent.substring(0, endIndex) + ']}';
      console.log('Repaired truncated scenario JSON:', repairedContent);
      return repairedContent;
    }
  }
  
  // Remove any trailing incomplete text after the last complete structure
  const lastCompleteCard = repairedContent.lastIndexOf('}');
  if (lastCompleteCard !== -1) {
    // Find if there's an incomplete card after the last complete one
    const afterLastCard = repairedContent.substring(lastCompleteCard + 1).trim();
    if (afterLastCard && !afterLastCard.startsWith(']')) {
      // Remove incomplete card data
      repairedContent = repairedContent.substring(0, lastCompleteCard + 1);
    }
  }
  
  // Ensure proper array closing
  if (!repairedContent.includes(']')) {
    repairedContent += '\n  ]\n';
  } else if (!repairedContent.trim().endsWith(']')) {
    // Find the last ] and ensure it's properly positioned
    const lastBracket = repairedContent.lastIndexOf(']');
    repairedContent = repairedContent.substring(0, lastBracket + 1);
  }
  
  // Ensure proper object closing
  if (!repairedContent.trim().endsWith('}')) {
    repairedContent += '\n}';
  }
  
  // Remove any trailing commas before closing brackets
  repairedContent = repairedContent.replace(/,(\s*[\]\}])/g, '$1');
  
  return repairedContent;
}

function analyzeJSONError(content: string, error: any): string {
  const errorMessage = error.message || '';
  const contentLength = content.length;
  const contentPreview = content.substring(0, 100) + (content.length > 100 ? '...' : '');
  
  if (errorMessage.includes('Unterminated string')) {
    return `Unterminated string detected. The response appears to be cut off mid-sentence. Content length: ${contentLength} characters. Preview: ${contentPreview}`;
  }
  
  if (errorMessage.includes('Unexpected end of JSON')) {
    return `JSON appears to be truncated. Expected closing brackets or braces are missing. Content length: ${contentLength} characters. Preview: ${contentPreview}`;
  }
  
  if (errorMessage.includes('Unexpected token')) {
    const match = errorMessage.match(/position (\d+)/);
    const position = match ? parseInt(match[1]) : 0;
    const context = content.substring(Math.max(0, position - 20), position + 20);
    return `Invalid JSON syntax at position ${position}. Context: "...${context}...". Full content length: ${contentLength} characters.`;
  }
  
  return `JSON parsing failed: ${errorMessage}. Content length: ${contentLength} characters. This may indicate the response was truncated or contains invalid JSON syntax. Preview: ${contentPreview}`;
}

export async function extractCardsFromImageWithGemini({
  imageData,
  sourceLang,
  targetLang,
  extractionType = 'everything'
}: GeminiImageRequest) {
  try {
    console.log('=== GEMINI DEBUG START ===');
    console.log('Source language:', sourceLang);
    console.log('Target language:', targetLang);
    console.log('Extraction type:', extractionType);
    console.log('Image data length:', imageData.length);
    console.log('Image data prefix:', imageData.substring(0, 50));
    
    const sourceLanguage = getFullLanguageName(sourceLang);
    const targetLanguage = getFullLanguageName(targetLang);
    
    console.log('Full language names:', sourceLanguage, '->', targetLanguage);
    
    // Create extraction type specific instructions
    const extractionInstructions = {
      nouns: `Extract ONLY individual nouns (people, places, things, concepts) that appear as standalone words or can be clearly identified. Skip verbs, adjectives, and other word types. For languages with grammatical gender (German, Spanish, French, Italian), always include the appropriate article (der/die/das, el/la, le/la, il/la) in the sourceText even if not visible in the image.`,
      verbs: "Extract ONLY verbs (action words, state verbs) that appear as standalone words or can be clearly identified. Skip nouns, adjectives, and other word types.",
      words: "Extract ONLY individual words that stand alone and are NOT part of complete sentences. Skip any words that are part of a sentence structure.",
      sentences: "Extract ONLY complete sentences or meaningful phrases with proper sentence structure. Do NOT extract individual standalone words."
    };

    const prompt = `You are a language learning assistant. Analyze this image and create flashcards for learning ${sourceLanguage}.

Look at the image and identify text written in ${sourceLanguage}. Then create useful flashcards for language learning.

EXTRACTION TYPE: ${extractionInstructions[extractionType as keyof typeof extractionInstructions] || extractionInstructions.nouns}

IMPORTANT: Return ONLY a valid JSON object. Do not include any other text, explanations, or markdown formatting.

For each suitable word or phrase you can identify from the image:
1. Extract the original text in ${sourceLanguage}
2. Provide a translation to ${targetLanguage}
3. Create a helpful memory aid or explanation
4. Rate your confidence (0.0 to 1.0)

JSON structure:
{
  "cards": [
    {
      "id": "1",
      "sourceText": "word_or_sentence_in_${sourceLanguage}",
      "targetText": "translation_in_${targetLanguage}",
      "explanation": "memory_aid_or_context",
      "type": "word",
      "confidence": 0.95
    }
  ]
}

IMPORTANT: Set "type" field to either "word" or "sentence" based on what you extracted.

Guidelines:
- Only extract clear, recognizable vocabulary from the image
- Follow the extraction type requirements strictly
- Skip unclear or garbled text
- Provide accurate translations
- Return empty cards array if no suitable content can be identified
- Do not include explanatory text outside the JSON`;

    console.log('Prompt created, length:', prompt.length);

    // Clean the image data - remove data URL prefix if present
    let cleanImageData = imageData;
    if (imageData.includes(',')) {
      cleanImageData = imageData.split(',')[1];
      console.log('Removed data URL prefix, new length:', cleanImageData.length);
    }

    // Determine MIME type from the original data
    let mimeType = "image/jpeg";
    if (imageData.startsWith('data:image/png')) {
      mimeType = "image/png";
    } else if (imageData.startsWith('data:image/webp')) {
      mimeType = "image/webp";
    }
    console.log('Detected MIME type:', mimeType);

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: cleanImageData
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 8192,
      }
    };

    console.log('Request body structure:', {
      contentsLength: requestBody.contents.length,
      partsLength: requestBody.contents[0].parts.length,
      hasText: !!requestBody.contents[0].parts[0].text,
      hasImage: !!requestBody.contents[0].parts[1].inline_data,
      mimeType: requestBody.contents[0].parts[1].inline_data?.mime_type,
      imageDataLength: requestBody.contents[0].parts[1].inline_data?.data.length
    });

    console.log('Sending request to:', GEMINI_API_URL);
    
    const apiKey = getGeminiAPIKey();
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please add your API key in Settings.');
    }
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error response:', errorText);
      
      // Handle specific error codes
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid or expired Gemini API key. Please check your API key in Settings.');
      } else if (response.status === 429) {
        throw new Error('API rate limit exceeded. Please wait a moment and try again.');
      } else if (response.status >= 500) {
        throw new Error('Gemini AI service is temporarily unavailable. Please try again later.');
      }
      
      // Try to parse the error for more details
      try {
        const errorObj = JSON.parse(errorText);
        console.error('Parsed error object:', errorObj);
        throw new Error(`Gemini API error: ${errorObj.error?.message || errorText}`);
      } catch (parseErr) {
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }
    }

    const result = await response.json();
    console.log('Gemini response structure:', Object.keys(result));
    console.log('Gemini full response:', result);

    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      console.error('Invalid response structure from Gemini API');
      throw new Error('Invalid response from Gemini API');
    }

    const content = result.candidates[0].content.parts[0].text;
    console.log('Gemini content (raw):', content);

    // Clean content by removing markdown code blocks if present
    const cleanedContent = content
      .replace(/```json\s*/, '')
      .replace(/```\s*$/, '')
      .trim();

    console.log('Cleaned content for parsing:', cleanedContent);

    try {
      const parsedResult = JSON.parse(cleanedContent);
      console.log('Parsed result:', parsedResult);
      console.log('Cards found:', parsedResult?.cards?.length || 0);
      console.log('=== GEMINI DEBUG END ===');
      return parsedResult?.cards || [];
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Content that failed to parse:', cleanedContent);
      
      // Attempt intelligent JSON repair for truncated responses
      console.log('Attempting JSON repair for truncated response...');
      try {
        let repairedContent = cleanedContent;
        
        // Enhanced repair for both cards and scenarios
        if (repairedContent.includes('"scenarios":[') && !repairedContent.endsWith(']}')) {
          // Handle scenario responses
          const scenarioMatches = repairedContent.match(/\{[^}]*"scenarioTheme"[^}]*\}/g);
          if (scenarioMatches && scenarioMatches.length > 0) {
            const lastCompleteScenario = scenarioMatches[scenarioMatches.length - 1];
            const lastScenarioIndex = repairedContent.lastIndexOf(lastCompleteScenario);
            const endIndex = lastScenarioIndex + lastCompleteScenario.length;
            
            // Truncate to last complete scenario and close the structure
            repairedContent = repairedContent.substring(0, endIndex) + ']}';
            console.log('Repaired scenario JSON:', repairedContent);
            
            const repairedResult = JSON.parse(repairedContent);
            console.log('Scenario repair successful! Scenarios found:', repairedResult?.scenarios?.length || 0);
            return repairedResult?.scenarios || [];
          }
        } else if (repairedContent.includes('"cards":[') && !repairedContent.endsWith(']}')) {
          // Handle card responses
          const cardMatches = repairedContent.match(/\{[^}]*"id"[^}]*\}/g);
          if (cardMatches && cardMatches.length > 0) {
            const lastCompleteCard = cardMatches[cardMatches.length - 1];
            const lastCardIndex = repairedContent.lastIndexOf(lastCompleteCard);
            const endIndex = lastCardIndex + lastCompleteCard.length;
            
            // Truncate to last complete card and close the structure
            repairedContent = repairedContent.substring(0, endIndex) + ']}';
            console.log('Repaired card JSON:', repairedContent);
            
            const repairedResult = JSON.parse(repairedContent);
            console.log('Card repair successful! Cards found:', repairedResult?.cards?.length || 0);
            return repairedResult?.cards || [];
          }
        }
      } catch (repairError) {
        console.error('JSON repair also failed:', repairError);
      }
      
      console.log('=== GEMINI DEBUG END (PARSE ERROR) ===');
      throw new Error('Failed to parse Gemini response as JSON');
    }

  } catch (error) {
    console.error('Gemini extraction error:', error);
    console.log('=== GEMINI DEBUG END (ERROR) ===');
    throw error;
  }
}

// Interface for the new scenario generation function
export interface GeminiScenarioRequest {
  userCards: Array<{ sourceText: string; targetText: string; type?: 'word' | 'sentence' }>; // User's cards (targetText is in targetLang)
  sourceLang: string; // User's native/known language (e.g., 'en')
  targetLang: string; // Language being learned (e.g., 'fr')
  // userNativeLang is essentially sourceLang for explanations
}

export interface GeminiGeneratedScenarioData {
  scenarioTheme: string;
  sentenceParts: Array<{ text: string; isKnown?: boolean; isBlank?: boolean; originalText?: string }>;
  sourceLanguageSentenceParts: Array<{ text: string; isGap?: boolean }>;
  correctWordsForBlanks: string[];
  distractorWords: string[];
  newWordsInScenario: Array<{ text: string; explanation: string }>;
}

export interface GeminiMultipleScenarioData {
  scenarios: GeminiGeneratedScenarioData[];
}

export async function generateScenarioWithGemini({
  userCards,
  sourceLang, // This is the user's native language for explanations
  targetLang, // This is the language the user is learning
}: GeminiScenarioRequest): Promise<GeminiGeneratedScenarioData[] | null> {
  try {
    console.log('=== GEMINI SCENARIO GENERATION START ===');
    console.log('Source Language (for explanations):', sourceLang);
    console.log('Target Language (for scenario):', targetLang);
    console.log('Number of user cards provided:', userCards.length);
    // Shuffle cards and take a random sample for better variety
    const shuffledCards = [...userCards].sort(() => Math.random() - 0.5);
    const sampleCards = shuffledCards.slice(0, Math.min(12, userCards.length));
    console.log('Sample cards (targetText):', sampleCards.map(c => c.targetText));

    const sourceLanguageFullName = getFullLanguageName(sourceLang);
    const targetLanguageFullName = getFullLanguageName(targetLang);

    const cardExamples = sampleCards.map(card => `- "${card.targetText}" (${card.type || 'word'})`).join('\n');

    const prompt = `Create 5 diverse sentence-building scenarios in ${targetLanguageFullName} for a language learner (native: ${sourceLanguageFullName}).

Use vocabulary from user's cards: ${cardExamples}

For each scenario:
1. Create a different everyday context (cafe, market, home, work, etc.)
2. Build a sentence using 1-3 user vocabulary words, replace them with "___"
3. Provide translation, distractors, and explanations for new words

Return JSON only:
{
  "scenarios": [
    {
      "scenarioTheme": "At the Bakery",
      "sentenceParts": [
        { "text": "Je voudrais", "isKnown": true },
        { "text": "___", "isBlank": true, "originalText": "un croissant" },
        { "text": " s'il vous plaît.", "isKnown": true }
      ],
      "sourceLanguageSentenceParts": [
        { "text": "I would like", "isGap": false },
        { "text": "a croissant", "isGap": true },
        { "text": " please.", "isGap": false }
      ],
      "correctWordsForBlanks": ["un croissant"],
      "distractorWords": ["un café", "une baguette", "un gâteau"],
      "newWordsInScenario": [
        { "text": "voudrais", "explanation": "means 'would like'" }
      ]
    }
  ]
}

Generate exactly 5 complete scenarios.`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6, // Slightly higher for creativity in scenario generation
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192, // Increased to prevent truncation
        response_mime_type: "application/json", // Request JSON output directly
      }
    };

    console.log('Sending scenario generation request to Gemini...');
    console.log('Request body generation config:', requestBody.generationConfig);
    console.log('Prompt length:', prompt.length);
    console.log('Max output tokens requested:', requestBody.generationConfig.maxOutputTokens);
    
    // Increment API call counter for scenario generation
    const currentCount = parseInt(localStorage.getItem('scenarioAPICalls') || '0');
    localStorage.setItem('scenarioAPICalls', (currentCount + 1).toString());
    
    const apiKey = getGeminiAPIKey();
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please add your API key in Settings.');
    }
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    console.log('Gemini scenario response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error response (scenario generation):', errorText);
      
      // Handle specific error codes
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid or expired Gemini API key (401/403). Please check your API key.');
      } else if (response.status === 429) {
        throw new Error('API rate limit exceeded (429). Please wait 1-2 minutes and try again.');
      } else if (response.status >= 500) {
        throw new Error('Gemini AI service is temporarily unavailable (500+). Try again later.');
      }
      
      throw new Error(`Gemini API error (scenario): ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Gemini scenario response structure:', Object.keys(result));
    console.log('Full Gemini response:', result);

    // Check if we have the expected response structure
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      console.error('Invalid response structure from Gemini API');
      console.error('Result structure:', result);
      throw new Error('Invalid response from Gemini API');
    }

    // Check for usage information to understand token limits
    if (result.usageMetadata) {
      console.log('Usage metadata:', result.usageMetadata);
      console.log('Prompt token count:', result.usageMetadata.promptTokenCount);
      console.log('Candidates token count:', result.usageMetadata.candidatesTokenCount);
      console.log('Total token count:', result.usageMetadata.totalTokenCount);
    }

    // Check if the response was truncated due to length
    if (result.candidates[0].finishReason) {
      console.log('Finish reason:', result.candidates[0].finishReason);
      if (result.candidates[0].finishReason === 'MAX_TOKENS') {
        console.warn('Response was truncated due to MAX_TOKENS limit!');
      }
    }

    // Extract the content from the nested structure
    const content = result.candidates[0].content.parts[0].text;
    console.log('Extracted content from Gemini response (length:', content.length, 'chars)');
    console.log('Content preview (first 200 chars):', content.substring(0, 200));
    console.log('Content ending (last 200 chars):', content.substring(Math.max(0, content.length - 200)));

    try {
      // Clean content by removing potential markdown formatting
      const cleanedContent = content
        .replace(/```json\s*/, '')
        .replace(/```\s*$/, '')
        .trim();

      console.log('Cleaned content for parsing:', cleanedContent);

      const parsedResult: GeminiMultipleScenarioData = JSON.parse(cleanedContent);
      console.log('Parsed Gemini scenario data:', parsedResult);

      // Basic validation of the parsed result with fallbacks
      if (!parsedResult.scenarios || !Array.isArray(parsedResult.scenarios) || parsedResult.scenarios.length === 0) {
        console.error('Parsed Gemini scenario data is missing scenarios array.');
        console.error('Available fields:', Object.keys(parsedResult));
        throw new Error('Gemini response is missing scenarios array.');
      }

      // Validate and fix each scenario
      const validScenarios = parsedResult.scenarios.filter(scenario => {
        // Check if the scenario has required fields
        if (!scenario.scenarioTheme || !scenario.sentenceParts || !scenario.correctWordsForBlanks) {
          console.warn('Skipping invalid scenario:', scenario);
          return false;
        }
        
        // Add fallbacks for missing fields
        if (!scenario.newWordsInScenario) {
          scenario.newWordsInScenario = [];
        }
        if (!scenario.distractorWords) {
          scenario.distractorWords = [];
        }
        if (!scenario.sourceLanguageSentenceParts) {
          scenario.sourceLanguageSentenceParts = [];
        }
        
        return true;
      });

      if (validScenarios.length === 0) {
        throw new Error('No valid scenarios found in Gemini response.');
      }

      console.log(`=== GEMINI SCENARIO GENERATION END (${validScenarios.length} scenarios) ===`);
      return validScenarios;

    } catch (parseError) {
      console.error('JSON parsing error (scenario generation):', parseError);
      console.error('Content that failed to parse:', content);
      
      // Try to repair truncated JSON specifically for multiple scenarios
      console.log('Attempting JSON repair for truncated multiple scenarios response...');
      try {
        let repairedContent = content.trim();
        
        // Remove any markdown formatting first
        repairedContent = repairedContent
          .replace(/```json\s*/, '')
          .replace(/```\s*$/, '')
          .trim();
        
        // Special handling for multiple scenarios structure
        if (repairedContent.includes('"scenarios"')) {
          console.log('Found scenarios structure, attempting repair...');
          
          // Find all complete scenario objects by looking for pattern: "},{"
          const scenarioSeparators = [...repairedContent.matchAll(/\},\s*\{/g)];
          console.log('Found scenario separators:', scenarioSeparators.length);
          
          if (scenarioSeparators.length > 0) {
            // Find the last complete scenario by looking for the pattern
            const lastSeparator = scenarioSeparators[scenarioSeparators.length - 1];
            const lastSeparatorIndex = lastSeparator.index + lastSeparator[0].length - 1; // Position after last complete scenario
            
            // Try to find the end of the last complete scenario
            let searchStart = lastSeparatorIndex;
            let braceCount = 1;
            let lastCompleteEnd = -1;
            
            for (let i = searchStart; i < repairedContent.length; i++) {
              if (repairedContent[i] === '{') {
                braceCount++;
              } else if (repairedContent[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  lastCompleteEnd = i;
                  break;
                }
              }
            }
            
            if (lastCompleteEnd !== -1) {
              // Truncate to last complete scenario
              repairedContent = repairedContent.substring(0, lastCompleteEnd + 1);
              console.log('Truncated to last complete scenario');
            }
          }
          
          // Ensure proper array and object closing
          if (!repairedContent.includes(']')) {
            repairedContent += '\n  ]\n}';
          } else if (!repairedContent.trim().endsWith(']}')) {
            // Find the last ] and ensure it's properly closed
            const lastBracket = repairedContent.lastIndexOf(']');
            if (lastBracket !== -1) {
              repairedContent = repairedContent.substring(0, lastBracket + 1) + '\n}';
            }
          }
        }
        
        // Remove trailing commas before closing brackets/braces
        repairedContent = repairedContent.replace(/,(\s*[\]\}])/g, '$1');
        
        console.log('Repaired JSON content:', repairedContent);
        const repairedResult = JSON.parse(repairedContent);
        
        // Ensure scenarios array exists and has valid structure
        if (repairedResult.scenarios && Array.isArray(repairedResult.scenarios)) {
          // Clean up scenarios and ensure required fields
          const cleanedScenarios = repairedResult.scenarios.filter((scenario: any) => {
            if (!scenario.scenarioTheme || !scenario.sentenceParts || !scenario.correctWordsForBlanks) {
              return false;
            }
            if (!scenario.newWordsInScenario) {
              scenario.newWordsInScenario = [];
            }
            if (!scenario.distractorWords) {
              scenario.distractorWords = [];
            }
            if (!scenario.sourceLanguageSentenceParts) {
              scenario.sourceLanguageSentenceParts = [];
            }
            return true;
          });
          
          if (cleanedScenarios.length > 0) {
            console.log('Repair successful for multiple scenarios!');
            return cleanedScenarios;
          }
        }
      } catch (repairError) {
        console.error('JSON repair also failed for multiple scenarios:', repairError);
      }
      
      console.log('=== GEMINI SCENARIO GENERATION END (PARSE ERROR) ===');
      throw new Error('Failed to parse Gemini scenario response as JSON.');
    }

  } catch (error) {
    console.error('Gemini scenario generation error:', error);
    console.log('=== GEMINI SCENARIO GENERATION END (ERROR) ===');
    return null; // Return null on error as per plan
  }
}

export async function getTranslationWithGemini({
  text,
  sourceLang,
  targetLang
}: GeminiTranslationRequest) {
  try {
    const sourceLanguage = getFullLanguageName(sourceLang);
    const targetLanguage = getFullLanguageName(targetLang);

    const prompt = `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Provide only the translation without any additional explanation:

${text}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 1024,
      }
    };

    const apiKey = getGeminiAPIKey();
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please add your API key in Settings.');
    }
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();

    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      throw new Error('Invalid response from Gemini API');
    }

    return result.candidates[0].content.parts[0].text.trim();

  } catch (error) {
    console.error('Gemini translation error:', error);
    throw error;
  }
}

// Grammar Lesson Generation Types
export interface GrammarLessonRequest {
  userCards: Array<{ sourceText: string; targetText: string; type?: 'word' | 'sentence' }>;
  sourceLang: string; // User's native language for explanations
  targetLang: string; // Language being learned
  previousLessons: Array<{ title: string; explanation: string }>;
  isExam?: boolean; // Whether to generate an exam instead of a regular lesson
  lessonNumber?: number; // The lesson number for tracking
}

// Helper function to get icon for lesson based on lesson number
export function getLessonIcon(lessonNumber: number, isExam: boolean): string {
  if (isExam) {
    return '🎓'; // Graduation cap for exams
  }
  
  // Cycle through different educational icons for lessons
  const lessonIcons = [
    '📖', // Book
    '✏️', // Pencil
    '📝', // Memo
    '📚', // Books
    '🔤', // ABC
    '📋', // Clipboard
    '🎯', // Target
    '💡', // Lightbulb
    '🔍', // Magnifying glass
    '⭐', // Star
  ];
  
  return lessonIcons[(lessonNumber - 1) % lessonIcons.length];
}

export interface GrammarLessonExercise {
  story: string; // The story with blanks (___) to fill
  correctWordsForBlanks: string[];
  distractorWords: string[];
  explanation?: string; // Optional explanation for this particular exercise
}

export interface GrammarLessonData {
  title: string; // The grammar concept being taught
  explanation: string; // Clear explanation of the concept in user's native language
  exercises: GrammarLessonExercise[]; // Multiple exercises that build on the concept
  newWords: Array<{ text: string; explanation: string }>; // New vocabulary introduced
  isExam?: boolean; // Whether this is an exam vs a regular lesson
  lessonNumber?: number; // Sequential lesson number for tracking
  icon?: string; // Emoji icon for the lesson
}


export async function generateGrammarLessonWithGemini({
  userCards,
  sourceLang, // User's native language for explanations
  targetLang, // Language being learned
  previousLessons = [],
  isExam = false,
  lessonNumber = 1
}: GrammarLessonRequest): Promise<GrammarLessonData | null> {
  try {
    console.log('=== GEMINI GRAMMAR LESSON GENERATION START ===');
    console.log('Type:', isExam ? 'EXAM' : 'LESSON');
    console.log('Lesson Number:', lessonNumber);
    console.log('Source Language (for explanations):', sourceLang);
    console.log('Target Language (for lesson):', targetLang);
    console.log('Number of user cards provided:', userCards.length);
    console.log('Number of previous lessons:', previousLessons.length);

    // Shuffle cards and take a random sample for better variety
    const shuffledCards = [...userCards].sort(() => Math.random() - 0.5);
    const sampleCards = shuffledCards.slice(0, Math.min(15, userCards.length));
    console.log('Sample cards (targetText):', sampleCards.map(c => c.targetText));

    const sourceLanguageFullName = getFullLanguageName(sourceLang);
    const targetLanguageFullName = getFullLanguageName(targetLang);

    const cardExamples = sampleCards.length > 0 
      ? sampleCards.map(card => `- "${card.targetText}" (${card.sourceText})`).join('\n')
      : 'No vocabulary cards yet - please use simple, beginner-friendly words in the exercises.';
    
    const previousLessonsText = previousLessons.length > 0 
      ? previousLessons.map(lesson => `- ${lesson.title}: ${lesson.explanation}`).join('\n')
      : 'None';

    // Different prompts for exam vs lesson
    const prompt = isExam ? 
      `You are an AI language teacher. Create a comprehensive EXAM for a user learning ${targetLanguageFullName} (native: ${sourceLanguageFullName}).

Previous lessons the user has completed:
${previousLessonsText}

${sampleCards.length > 0 ? `User's known vocabulary:\n${cardExamples}` : 'Note: User has limited vocabulary, so use simple beginner words.'}

Create an EXAM that:
1. Tests ALL the grammar concepts covered in the previous lessons
2. Has a comprehensive explanation in ${sourceLanguageFullName} that reviews ALL previous concepts
3. Includes 5-7 exercises that test different concepts from the previous lessons
4. Uses simple beginner vocabulary suitable for their level
5. Mixes concepts to test understanding
6. Each exercise should have a translation in parentheses

Return JSON only (no markdown formatting):
{
  "title": "Exam: Review of Lessons 1-4",
  "explanation": "This exam reviews all the concepts from your previous lessons...",
  "exercises": [
    {
      "story": "Tôi ___ sinh viên. (I am a student.)",
      "correctWordsForBlanks": ["là"],
      "distractorWords": ["không", "phải", "có"],
      "explanation": "Testing basic 'to be' structure from Lesson 1"
    }
  ],
  "newWords": []
}

IMPORTANT: Create 5-7 exercises that test multiple concepts from previous lessons. Each exercise must include the translation in parentheses.` 
      : 
      `You are an AI language teacher. Create a structured grammar lesson for a user learning ${targetLanguageFullName} (native: ${sourceLanguageFullName}).

User's known vocabulary: ${cardExamples}

Previous lessons completed:
${previousLessonsText}

Create a NEW grammar lesson that:
1. Introduces ONE specific grammar concept appropriate for their level
2. Builds upon previous lessons (don't repeat concepts)
3. Uses their known vocabulary where possible
4. Provides multiple exercises to practice the concept
5. Starts very basic and builds up gradually

Return JSON only:
{
  "title": "Present Tense Conjugation",
  "explanation": "Clear explanation of the grammar concept in ${sourceLanguageFullName}",
  "exercises": [
    {
      "story": "Je ___ français. (I speak French.)",
      "correctWordsForBlanks": ["parle"],
      "distractorWords": ["parles", "parlent", "parlons"],
      "explanation": "First person singular uses 'parle' ending"
    },
    {
      "story": "Tu ___ anglais très bien. (You speak English very well.)",
      "correctWordsForBlanks": ["parles"],
      "distractorWords": ["parle", "parlent", "parlons"],
      "explanation": "Second person singular uses 'parles' ending"
    }
  ],
  "newWords": [
    { "text": "très", "explanation": "means 'very'" }
  ]
}

Create 3-5 exercises that progressively build the concept. Each exercise should be a short, practical sentence.`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7, // Balanced for educational content
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
        response_mime_type: "application/json", // Request JSON output directly
      }
    };

    console.log('Sending grammar lesson generation request to Gemini...');
    console.log('Request body generation config:', requestBody.generationConfig);
    console.log('Prompt length:', prompt.length);
    
    // Increment API call counter for grammar lesson generation
    const currentCount = parseInt(localStorage.getItem('grammarLessonAPICalls') || '0');
    localStorage.setItem('grammarLessonAPICalls', (currentCount + 1).toString());
    
    const apiKey = getGeminiAPIKey();
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please add your API key in Settings.');
    }
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      
      // Handle specific error codes with user-friendly messages
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid or expired Gemini API key (401/403). Please check your API key in Settings.');
      } else if (response.status === 429) {
        throw new Error('API rate limit exceeded (429). Please wait 1-2 minutes and try again.');
      } else if (response.status === 400) {
        // Try to get more details from error
        try {
          const errorObj = JSON.parse(errorText);
          const errorMsg = errorObj.error?.message || errorText;
          if (errorMsg.includes('API_KEY')) {
            throw new Error('Invalid API key format. Please check your Gemini API key.');
          }
          throw new Error(`Bad request (400): ${errorMsg}`);
        } catch {
          throw new Error(`Bad request (400): ${errorText}`);
        }
      } else if (response.status >= 500) {
        throw new Error('Gemini AI service is temporarily unavailable (500+). Please try again later.');
      }
      
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Gemini API response status:', response.status);
    console.log('Full Gemini response:', JSON.stringify(result, null, 2));

    // Check for errors or blocked content
    if (result.promptFeedback?.blockReason) {
      console.error('Gemini blocked the request:', result.promptFeedback);
      throw new Error(`Content was blocked by safety filters: ${result.promptFeedback.blockReason}`);
    }

    if (!result.candidates || result.candidates.length === 0) {
      console.error('No candidates in Gemini response:', result);
      // Check if there's an error in the response
      if (result.error) {
        throw new Error(`Gemini error: ${result.error.message || JSON.stringify(result.error)}`);
      }
      throw new Error('Gemini API returned no response. The request may have been filtered or quota exceeded.');
    }

    const candidate = result.candidates[0];
    
    // Check if content was blocked
    if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
      console.error('Content was blocked by safety filters:', candidate);
      throw new Error(`Content generation was blocked due to: ${candidate.finishReason}`);
    }

    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.error('Invalid Gemini response structure - missing parts:', result);
      console.error('Candidate:', candidate);
      throw new Error('Invalid response from Gemini API - missing content parts');
    }

    const content = candidate.content.parts[0].text;
    console.log('Extracted content from Gemini response (length:', content.length, 'chars)');
    console.log('Content preview (first 200 chars):', content.substring(0, 200));

    try {
      // Clean content by removing potential markdown formatting
      const cleanedContent = content
        .replace(/```json\s*/, '')
        .replace(/```\s*$/, '')
        .trim();

      console.log('Cleaned content for parsing:', cleanedContent);

      const parsedResult: GrammarLessonData = JSON.parse(cleanedContent);
      console.log('Parsed Gemini grammar lesson data:', parsedResult);

      // Basic validation of the parsed result
      if (!parsedResult.title || !parsedResult.explanation || !parsedResult.exercises) {
        console.error('Parsed Gemini grammar lesson data is missing required fields.');
        console.error('Available fields:', Object.keys(parsedResult));
        throw new Error('Gemini response is missing required fields.');
      }

      // Validate exercises array
      if (!Array.isArray(parsedResult.exercises) || parsedResult.exercises.length === 0) {
        console.error('Parsed Gemini grammar lesson data has invalid exercises array.');
        throw new Error('Gemini response has invalid exercises.');
      }

      // Add fallbacks for missing optional fields
      if (!parsedResult.newWords) {
        parsedResult.newWords = [];
      }

      // Validate each exercise
      const validExercises = parsedResult.exercises.filter(exercise => {
        if (!exercise.story || !exercise.correctWordsForBlanks || !Array.isArray(exercise.correctWordsForBlanks)) {
          console.warn('Skipping invalid exercise:', exercise);
          return false;
        }
        
        // Add fallbacks for missing fields
        if (!exercise.distractorWords) {
          exercise.distractorWords = [];
        }
        
        return true;
      });

      if (validExercises.length === 0) {
        throw new Error('No valid exercises found in Gemini response.');
      }

      parsedResult.exercises = validExercises;
      
      // Add metadata
      parsedResult.isExam = isExam;
      parsedResult.lessonNumber = lessonNumber;
      parsedResult.icon = getLessonIcon(lessonNumber, isExam);

      console.log(`=== GEMINI GRAMMAR LESSON GENERATION END (${validExercises.length} exercises) ===`);
      return parsedResult;

    } catch (parseError) {
      console.error('JSON parsing error (grammar lesson generation):', parseError);
      console.error('Content that failed to parse:', content);
      
      // Attempt to repair truncated JSON
      console.log('Attempting JSON repair for truncated response...');
      try {
        const repairedContent = repairTruncatedJSON(content);
        if (repairedContent) {
          console.log('JSON repair successful, retrying parse...');
          const repairedResult: GrammarLessonData = JSON.parse(repairedContent);
          
          // Still validate the repaired result
          if (repairedResult.title && repairedResult.explanation && repairedResult.exercises && Array.isArray(repairedResult.exercises)) {
            console.log('Repaired JSON is valid, using it');
            return repairedResult;
          }
        }
      } catch (repairError) {
        console.error('JSON repair also failed:', repairError);
      }
      
      throw new Error('Failed to parse Gemini response as valid JSON. Response may be truncated due to token limits.');
    }

  } catch (error) {
    console.error('Gemini grammar lesson generation error:', error);
    console.log('=== GEMINI GRAMMAR LESSON GENERATION END (ERROR) ===');
    
    // Add specific error context for better user messaging
    if (error instanceof Error && error.message.includes('JSON')) {
      throw new Error('The AI service returned an incomplete response. This often happens during high demand periods.');
    } else if (error instanceof Error && error.message.includes('network')) {
      throw new Error('Network connection issue prevented lesson generation.');
    } else {
      throw error;
    }
  }
}