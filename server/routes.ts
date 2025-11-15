import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { translationRequestSchema } from "@shared/schema";
import { z } from "zod";
import { googleTextToSpeechHandler, initializeTTSClient } from "./google-tts";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/text-to-speech", googleTextToSpeechHandler);
  
  // Configure TTS with credentials
  app.post("/api/configure-tts", async (req, res) => {
    try {
      const { credentials } = req.body;
      
      if (!credentials || typeof credentials !== 'object') {
        return res.status(400).json({ error: 'Invalid credentials format' });
      }
      
      const success = initializeTTSClient(credentials);
      if (success) {
        res.json({ success: true, message: 'TTS client configured successfully' });
      } else {
        res.status(500).json({ error: 'Failed to initialize TTS client' });
      }
    } catch (error) {
      console.error('TTS Configuration Error:', error);
      res.status(500).json({ error: 'Configuration failed' });
    }
  });
  
  // Get TTS usage statistics
  app.get("/api/tts-stats", async (req, res) => {
    try {
      const callCount = parseInt(process.env.TTS_API_CALLS || '0');
      res.json({ totalCalls: callCount });
    } catch (error) {
      console.error('TTS Stats Error:', error);
      res.status(500).json({ error: 'Failed to get TTS statistics' });
    }
  });
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

  // AI categorization endpoint using Mistral
  app.post('/api/categorize', async (req, res) => {
    try {
      const { cards, mode } = req.body;
      
      if (!cards || !Array.isArray(cards)) {
        return res.status(400).json({ error: 'Invalid cards data' });
      }

      const MISTRAL_API_KEY = "L3yfMiUpTMFb5T2GmRw6rCDNoAXl41fR";
      const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

      let prompt;
      
      if (mode === 'merge') {
        // Re-evaluate and merge existing categories
        const cardsText = cards.map(card => 
          `ID: ${card.id}, Word: "${card.sourceText}", Translation: "${card.targetText}", Type: ${card.type}, Current Category: "${card.currentCategory}"`
        ).join('\n');
        
        prompt = `Please re-evaluate and optimize the categories for these language learning cards. Your tasks:
1. Merge similar categories (e.g., "food" and "breakfast" should both be "Food")
2. Use broad, intuitive categories like "Animals", "Food", "Colors", "Family", "Transportation"
3. Keep good existing categories unchanged
4. Provide appropriate emojis for each category

Cards with current categories:
${cardsText}

Please respond with a JSON object in this exact format:
{
  "cards": [
    {
      "id": 1,
      "category": "Animals",
      "categoryEmoji": "🐾"
    }
  ]
}

IMPORTANT: Respond ONLY with valid JSON, no additional text or explanations.`;
      } else {
        // Original categorization for uncategorized cards
        const cardsText = cards.map(card => `ID: ${card.id}, Word: "${card.sourceText}", Translation: "${card.targetText}", Type: ${card.type}`).join('\n');
        
        prompt = `Please categorize the following language learning cards into logical categories. For each card, provide a category name and a fitting emoji. Merge similar categories (e.g., "food" and "breakfast" should both be "Food"). Use broad, intuitive categories like "Animals", "Food", "Colors", "Family", "Transportation", etc.

Cards to categorize:
${cardsText}

Please respond with a JSON object in this exact format:
{
  "cards": [
    {
      "id": 1,
      "category": "Animals",
      "categoryEmoji": "🐾"
    }
  ]
}

IMPORTANT: Respond ONLY with valid JSON, no additional text or explanations.`;
      }

      const response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
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
          max_tokens: 2000,
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
      
      // Parse the JSON response
      const categorizedData = JSON.parse(cleanContent);
      res.json(categorizedData);

    } catch (error) {
      console.error('Categorization error:', error);
      res.status(500).json({ error: 'Failed to categorize cards' });
    }
  });

  // Legacy scan endpoint - now handled by Gemini AI on frontend
  app.post("/api/scan/extract", async (req, res) => {
    res.status(410).json({
      error: 'This endpoint has been deprecated. Scan processing now uses Gemini AI directly from the frontend.',
      message: 'Please use the updated scan interface which processes images with Gemini AI.'
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}