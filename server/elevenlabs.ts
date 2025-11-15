import { getElevenLabsAudio } from "../lib/elevenlabs";
import { z } from "zod";

const textToSpeechRequestSchema = z.object({
  text: z.string(),
  voiceId: z.string(),
});

export async function textToSpeechHandler(req, res) {
  try {
    const { text, voiceId } = textToSpeechRequestSchema.parse(req.body);
    const audioStream = await getElevenLabsAudio(text, voiceId);
    res.setHeader("Content-Type", "audio/mpeg");
    audioStream.pipe(res);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error('ElevenLabs TTS Error:', error);
      
      // Check if it's an ElevenLabs API error
      if (error.statusCode === 401 || error.statusCode === 403) {
        res.status(503).json({ 
          error: "Text-to-speech service temporarily unavailable",
          details: "API key issue detected"
        });
      } else if (error.statusCode === 429) {
        res.status(429).json({ 
          error: "Rate limit exceeded", 
          details: "Please wait before trying again"
        });
      } else {
        res.status(500).json({ 
          error: "Text-to-speech service error",
          details: "Unable to generate audio"
        });
      }
    }
  }
}
