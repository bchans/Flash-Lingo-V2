/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at
 * https://firebase.google.com/docs/functions
 */

const functions = require("firebase-functions");
const {TextToSpeechClient} = require("@google-cloud/text-to-speech");

// Initialize the Text-to-Speech client outside the function for efficiency
const ttsClient = new TextToSpeechClient();

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
functions.setGlobalOptions({maxInstances: 10});

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// Function to generate a grammar lesson
exports.generateGrammarLesson = functions.https.onCall(
    {
      cors: true,
    },
    async (data, context) => {
      try {
        // Input validation
        if (!data || typeof data !== "object") {
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Request data must be an object",
          );
        }

        const {userCards, sourceLang, targetLang, previousLessons} = data;

        if (!userCards || !Array.isArray(userCards) || userCards.length === 0) {
          throw new functions.https.HttpsError(
              "invalid-argument",
              "User cards are required and must be a non-empty array",
          );
        }

        if (!sourceLang || typeof sourceLang !== "string") {
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Source language is required and must be a string",
          );
        }

        if (!targetLang || typeof targetLang !== "string") {
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Target language is required and must be a string",
          );
        }

        const config = functions.config();
        const geminiKey = config.gemini.api_key;

        if (!geminiKey) {
          throw new functions.https.HttpsError(
              "failed-precondition",
              "Gemini API key not configured",
          );
        }

        const geminiUrl = "https://generativelanguage.googleapis.com/" +
          "v1beta/models/gemini-1.5-flash-latest:generateContent?key=" +
          geminiKey;

        const prompt = `
          You are an AI language teacher. Your goal is to create a short, engaging grammar lesson for a user learning ${targetLang}.
          The user's native language is ${sourceLang}.
          The user has provided the following vocabulary words they know:
          ${userCards.map((card) => `- ${card.targetText} (${card.sourceText})`).join("\n")}

          The user has already completed the following grammar lessons:
          ${previousLessons && previousLessons.length > 0 ? previousLessons.map((lesson) => `- ${lesson.title}: ${lesson.explanation}`).join("\n") : "None"}

          Please generate a new grammar lesson that builds on their existing knowledge.
          The lesson should be appropriate for a beginner, but introduce a new concept.
          The lesson should include:
          1. A short, clear title for the grammar concept.
          2. A brief explanation of the concept in ${sourceLang}.
          3. A short story in ${targetLang} that uses the new grammar concept and some of the user's vocabulary.
          4. The story should have some words replaced with "___" for the user to fill in.
          5. A list of the correct words for the blanks.
          6. A list of distractor words.
          7. A list of any new vocabulary words introduced in the story, with explanations in ${sourceLang}.

          Format your response as a single JSON object with the following keys:
          - "title": string
          - "explanation": string
          - "story": string
          - "correctWordsForBlanks": string[]
          - "distractorWords": string[]
          - "newWords": { text: string; explanation: string; }[]
        `;

        const geminiResponse = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt,
              }],
            }],
          }),
        });

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          functions.logger.error(
              `Gemini API error ${geminiResponse.status}: ${errorText}`,
          );
          throw new functions.https.HttpsError(
              "internal",
              `Gemini API error: ${geminiResponse.status} - ${errorText}`,
          );
        }

        const responseData = await geminiResponse.json();

        // Validate response structure
        if (!responseData.candidates ||
            !responseData.candidates[0] ||
            !responseData.candidates[0].content ||
            !responseData.candidates[0].content.parts ||
            !responseData.candidates[0].content.parts[0]) {
          functions.logger.warn("Unexpected Gemini response structure", {
            responseData,
          });
          throw new functions.https.HttpsError(
              "internal",
              "Unexpected response format from Gemini API",
          );
        }

        const content = responseData.candidates[0].content.parts[0].text;

        try {
          const parsed = JSON.parse(content);
          return parsed;
        } catch (parseError) {
          functions.logger.warn(
              `Failed to parse Gemini response as JSON: ${parseError.message}`,
              {content, parseError: parseError.message},
          );
          throw new functions.https.HttpsError(
              "internal",
              "Failed to parse Gemini response as JSON",
          );
        }
      } catch (error) {
        functions.logger.error("Error in generateGrammarLesson:", error);
        // Re-throw HttpsError as-is, wrap other errors
        if (error instanceof functions.https.HttpsError) {
          throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            "Failed to generate grammar lesson",
        );
      }
    },
);


// Function to get Mistral translation
exports.getMistralTranslation = functions.https.onCall(
    {
      cors: true,
    },
    async (data, context) => {
      try {
        // Input validation
        if (!data || typeof data !== "object") {
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Request data must be an object",
          );
        }

        const {text, sourceLang, targetLang} = data;

        if (!text || typeof text !== "string") {
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Text is required and must be a string",
          );
        }

        if (!sourceLang || typeof sourceLang !== "string") {
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Source language is required and must be a string",
          );
        }

        if (!targetLang || typeof targetLang !== "string") {
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Target language is required and must be a string",
          );
        }

        const config = functions.config();
        const mistralKey = config.mistral.api_key;

        if (!mistralKey) {
          throw new functions.https.HttpsError(
              "failed-precondition",
              "Mistral API key not configured",
          );
        }

        const mistralResponse = await fetch(
            "https://api.mistral.ai/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${mistralKey}`,
              },
              body: JSON.stringify({
                model: "mistral-large-latest",
                messages: [{
                  role: "user",
                  content: `Translate the following text from ` +
                    `${sourceLang} to ` +
                    `${targetLang}. Also provide a brief explanation of ` +
                    `the translation and a memory aid to help remember it. ` +
                    `Format your response as JSON with "translation", ` +
                    `"explanation", and "memoryAid" fields.\n\nText to ` +
                    `translate: ${text}`,
                }],
                temperature: 0.7,
                max_tokens: 1000,
              }),
            },
        );

        if (!mistralResponse.ok) {
          const errorText = await mistralResponse.text();
          functions.logger.error(
              `Mistral API error ${mistralResponse.status}: ${errorText}`,
          );
          throw new functions.https.HttpsError(
              "internal",
              `Mistral API error: ${mistralResponse.status} - ${errorText}`,
          );
        }

        const responseData = await mistralResponse.json();
        const content = responseData.choices[0].message.content;

        try {
          const parsed = JSON.parse(content);
          return {
            translation: parsed.translation,
            explanation: parsed.explanation,
            memoryAid: parsed.memoryAid,
          };
        } catch (parseError) {
          // Log the parsing failure for debugging
          functions.logger.warn(
              `Failed to parse Mistral response as JSON: ${parseError.message}`,
              {content, parseError: parseError.message},
          );
          // If JSON parsing fails, return the raw content
          return {
            translation: content,
            explanation: "",
            memoryAid: "",
          };
        }
      } catch (error) {
        functions.logger.error("Error in getMistralTranslation:", error);
        // Re-throw HttpsError as-is, wrap other errors
        if (error instanceof functions.https.HttpsError) {
          throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            "Failed to get Mistral translation",
        );
      }
    },
);

// Function to get Gemini response
exports.getGeminiResponse = functions.https.onCall(
    {
      cors: true,
    },
    async (data, context) => {
      try {
        // Input validation
        if (!data || typeof data !== "object") {
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Request data must be an object",
          );
        }

        const {prompt} = data;

        if (!prompt || typeof prompt !== "string") {
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Prompt is required and must be a string",
          );
        }

        const config = functions.config();
        const geminiKey = config.gemini.api_key;

        if (!geminiKey) {
          throw new functions.https.HttpsError(
              "failed-precondition",
              "Gemini API key not configured",
          );
        }

        const geminiUrl = "https://generativelanguage.googleapis.com/" +
          "v1beta/models/gemini-1.5-flash-latest:generateContent?key=" +
          geminiKey;

        const geminiResponse = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt,
              }],
            }],
          }),
        });

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          functions.logger.error(
              `Gemini API error ${geminiResponse.status}: ${errorText}`,
          );
          throw new functions.https.HttpsError(
              "internal",
              `Gemini API error: ${geminiResponse.status} - ${errorText}`,
          );
        }

        const responseData = await geminiResponse.json();

        // Validate response structure
        if (!responseData.candidates ||
            !responseData.candidates[0] ||
            !responseData.candidates[0].content ||
            !responseData.candidates[0].content.parts ||
            !responseData.candidates[0].content.parts[0]) {
          functions.logger.warn("Unexpected Gemini response structure", {
            responseData,
          });
          throw new functions.https.HttpsError(
              "internal",
              "Unexpected response format from Gemini API",
          );
        }

        return {
          response: responseData.candidates[0].content.parts[0].text,
        };
      } catch (error) {
        functions.logger.error("Error in getGeminiResponse:", error);
        // Re-throw HttpsError as-is, wrap other errors
        if (error instanceof functions.https.HttpsError) {
          throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            "Failed to get Gemini response",
        );
      }
    },
);

// Function to get Google Cloud Text-to-Speech audio
exports.getGeminiTTS = functions.https.onCall(
    {
      cors: true,
    },
    async (data, context) => {
      try {
        // Input validation
        if (!data || typeof data !== "object") {
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Request data must be an object",
          );
        }

        // Extract data from the request
        const requestData = data.data || data;
        const {text, languageCode = "en-US", voiceName} = requestData;

        functions.logger.info("getGeminiTTS called with:", {
          text: text,
          textType: typeof text,
          languageCode: languageCode,
          voiceName: voiceName,
          dataKeys: Object.keys(data),
          requestData: requestData,
        });

        if (!text || typeof text !== "string") {
          functions.logger.error("Invalid text parameter:", {
            text: text,
            textType: typeof text,
            textLength: text ? text.length : "undefined",
          });
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Text is required and must be a string",
          );
        }

        if (!languageCode || typeof languageCode !== "string") {
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Language code is required and must be a string",
          );
        }

        if (voiceName && typeof voiceName !== "string") {
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Voice name must be a string",
          );
        }

        // Construct the TTS request
        const request = {
          input: {text: text},
          voice: {
            languageCode: languageCode,
            // Use provided voice name or let the service choose
            ...(voiceName && {name: voiceName}),
          },
          audioConfig: {
            audioEncoding: "MP3", // Common format for browser playback
            speakingRate: 1.0,
            pitch: 0.0,
          },
        };

        // Call the Google Cloud Text-to-Speech API
        functions.logger.info("Calling Google Cloud Text-to-Speech API", {
          text: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
          languageCode,
          voiceName,
        });

        const [response] = await ttsClient.synthesizeSpeech(request);

        if (!response.audioContent) {
          throw new functions.https.HttpsError(
              "internal",
              "No audio content returned from Text-to-Speech API",
          );
        }

        // Convert audio content to base64 for transport
        const audioBase64 = Buffer.from(response.audioContent)
            .toString("base64");

        functions.logger.info("Successfully generated TTS audio", {
          audioSizeKB: Math.round(audioBase64.length / 1024),
          languageCode,
          voiceName,
        });

        return {
          audioContent: audioBase64,
          languageCode: languageCode,
          originalText: text,
        };
      } catch (error) {
        functions.logger.error("Error in getGeminiTTS:", error);

        // Handle specific Google Cloud TTS errors
        if (error.code === 3) { // INVALID_ARGUMENT
          throw new functions.https.HttpsError(
              "invalid-argument",
              `Invalid TTS parameters: ${error.message}`,
          );
        } else if (error.code === 7) { // PERMISSION_DENIED
          throw new functions.https.HttpsError(
              "permission-denied",
              "Permission denied for Text-to-Speech API",
          );
        } else if (error.code === 8) { // RESOURCE_EXHAUSTED
          throw new functions.https.HttpsError(
              "resource-exhausted",
              "Text-to-Speech API quota exceeded",
          );
        }

        // Re-throw HttpsError as-is, wrap other errors
        if (error instanceof functions.https.HttpsError) {
          throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            "Failed to generate speech audio",
        );
      }
    },
);
