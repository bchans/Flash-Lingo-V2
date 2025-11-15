import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { translationRequestSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post('/api/translate', async (req, res) => {
    try {
      const data = translationRequestSchema.parse(req.body);
      
      // Call Mistral API here if needed for server-side processing
      // For this implementation we're using direct client-side API calls
      
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // API route for scan mode - extract cards from image (deprecated - now using Gemini)
  app.post("/api/scan/extract", async (req, res) => {
    try {
      console.log('Scan extract request received');
      console.log('Request body keys:', Object.keys(req.body));
      console.log('Image data length:', req.body.imageData?.length || 0);
      console.log('Source lang:', req.body.sourceLang);
      console.log('Target lang:', req.body.targetLang);
      console.log('Existing cards count:', req.body.existingCards?.length || 0);
      
      const { imageData, sourceLang, targetLang, existingCards, extractionType = 'everything' } = req.body;
      
      if (!imageData || !sourceLang || !targetLang) {
        console.log('Missing required fields');
        return res.status(400).json({
          error: "Missing required fields: imageData, sourceLang, targetLang"
        });
      }

      // Use Tesseract.js for OCR, then Mistral AI for processing
      console.log('Processing image with Tesseract OCR + Mistral AI...');
      
      let extractedText = '';
      let extractedData;
      
      try {
        // Import Tesseract.js for OCR
        const { createWorker } = await import('tesseract.js');
        
        console.log('Initializing Tesseract worker...');
        
        // Determine OCR language based on target language
        const tesseractLang = targetLang === 'es' ? 'spa' : 
                             targetLang === 'fr' ? 'fra' :
                             targetLang === 'de' ? 'deu' :
                             targetLang === 'it' ? 'ita' :
                             targetLang === 'pt' ? 'por' : 'eng';
        
        const worker = await createWorker(tesseractLang);
        
        // Configure Tesseract for better accuracy
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ0123456789.,;:!?()[]{}"-\' '
        });
        
        // Convert base64 to buffer for Tesseract
        const imageBuffer = Buffer.from(imageData, 'base64');
        
        console.log(`Extracting text from image using ${tesseractLang} language model...`);
        const { data: { text } } = await worker.recognize(imageBuffer);
        extractedText = text.trim();
        
        await worker.terminate();
        console.log('Extracted text:', extractedText);
        
        if (!extractedText || extractedText.length < 3) {
          return res.status(400).json({
            error: "No readable text found in the image. Please try with an image containing clear, readable text with good lighting and contrast."
          });
        }
        
        // Clean up OCR text - remove excessive whitespace and garbled characters
        extractedText = extractedText
          .replace(/[^\w\sÀ-ÿ.,;:!?()[\]{}"-]/g, ' ') // Remove non-text characters
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        // Use Mistral AI to process the extracted text and create flashcards
        const MISTRAL_API_KEY = "L3yfMiUpTMFb5T2GmRw6rCDNoAXl41fR";
        const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
        
        // Create extraction type specific instructions
        const extractionInstructions = {
          everything: "Extract all suitable vocabulary including nouns, verbs, adjectives, and useful phrases.",
          nouns: "Extract ONLY nouns (people, places, things, concepts). Skip verbs, adjectives, and other word types.",
          verbs: "Extract ONLY verbs (action words, state verbs). Skip nouns, adjectives, and other word types.",
          words: "Extract individual words only. Do not extract phrases or sentences.",
          sentences: "Extract complete sentences or meaningful phrases. Skip individual words."
        };

        const prompt = `You are a language learning assistant. Analyze the following OCR-extracted text and create flashcards for learning ${targetLang}.

The text may contain OCR errors or be fragmented. Try to identify recognizable words or phrases that could be useful for language learning.

Extracted text: "${extractedText}"

EXTRACTION TYPE: ${extractionInstructions[extractionType as keyof typeof extractionInstructions] || extractionInstructions.everything}

IMPORTANT: Return ONLY a valid JSON object. Do not include any other text, explanations, or markdown formatting.

For each suitable word or phrase you can identify:
1. Extract the original text in ${targetLang} (clean up OCR errors if possible)
2. Provide a translation to ${sourceLang}
3. Create a helpful memory aid or explanation
4. Rate your confidence (0.0 to 1.0)

JSON structure:
{
  "cards": [
    {
      "id": "1",
      "sourceText": "word_in_${targetLang}",
      "targetText": "translation_in_${sourceLang}",
      "explanation": "memory_aid_or_context",
      "confidence": 0.95
    }
  ]
}

Guidelines:
- Only extract clear, recognizable vocabulary despite OCR errors
- Follow the extraction type requirements strictly
- Skip garbled text that cannot be interpreted
- Provide accurate translations for identified words
- Return empty cards array if no suitable content can be identified
- Do not include explanatory text outside the JSON

Existing cards to avoid:
${existingCards.map((card: any) => `- ${card.sourceText}`).join('\n')}`;

        console.log('Sending extracted text to Mistral AI...');
        const mistralResponse = await fetch(MISTRAL_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MISTRAL_API_KEY}`
          },
          body: JSON.stringify({
            model: "mistral-medium-2505",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
          })
        });

        if (!mistralResponse.ok) {
          throw new Error('Mistral API request failed');
        }

        const mistralResult = await mistralResponse.json();
        let content = mistralResult.choices[0]?.message?.content || '{}';
        console.log('Mistral response:', content);
        
        // Clean up Mistral response - remove markdown code blocks if present
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        
        // Extract JSON if there's additional text before it
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          content = jsonMatch[0];
        }
        
        console.log('Cleaned content for parsing:', content);
        
        try {
          extractedData = JSON.parse(content);
        } catch (parseError) {
          console.error('Error parsing Mistral response:', parseError);
          console.error('Content that failed to parse:', content);
          return res.status(500).json({
            error: "Failed to parse AI response. Please try again with a clearer image."
          });
        }
        
      } catch (ocrError) {
        console.error('OCR processing error:', ocrError);
        return res.status(500).json({
          error: "Failed to extract text from image. Please try with a clearer image."
        });
      }

      // Check for duplicates and mark them
      const cards = (extractedData?.cards || []).map((card: any) => {
        const isDuplicate = existingCards.some((existing: any) =>
          existing.sourceText.toLowerCase().trim() === card.sourceText.toLowerCase().trim() ||
          existing.targetText.toLowerCase().trim() === card.targetText.toLowerCase().trim()
        );

        return {
          ...card,
          isExisting: isDuplicate
        };
      });

      res.json({ cards });
    } catch (error) {
      console.error("Scan extraction error:", error);
      
      res.status(500).json({
        error: "Failed to process image. Please try again with a clearer image."
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
