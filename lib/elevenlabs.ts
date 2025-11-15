import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export async function getElevenLabsAudio(text: string, voiceId: string) {
  const elevenlabs = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
  });

  const audio = await elevenlabs.textToSpeech.convert(voiceId, {
    text,
    model_id: "eleven_multilingual_v2",
  });

  return audio;
}
