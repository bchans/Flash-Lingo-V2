# FlashLingo - AI-Powered Language Learning App

## Overview

FlashLingo is a Progressive Web App (PWA) for language learning through AI-powered flashcards. The application uses multiple AI services (Mistral AI, Google Gemini) to create intelligent translation cards with memory aids and supports various study modes including flashcards, multiple choice, streak challenges, and even a 3D driving game for immersive learning.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom theme support
- **State Management**: Zustand for preferences and application state
- **Routing**: Wouter for lightweight client-side routing
- **PWA Features**: Service worker registration and offline support

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Database**: Client-side IndexedDB via Dexie.js for offline-first storage
- **API Integration**: Direct client-side calls to external AI services
- **Development**: Hot module replacement with Vite dev server

### Key Technologies
- **AI Services**: Mistral AI for translations, Google Gemini for image processing
- **3D Graphics**: Three.js for the driving game study mode
- **Database**: Drizzle ORM configured for PostgreSQL (not yet implemented)
- **Validation**: Zod for schema validation
- **Forms**: React Hook Form with resolvers

## Key Components

### Core Features
1. **Card Creation**: AI-powered translation with explanations and memory aids
2. **Image Scanning**: OCR and AI extraction from photos using Gemini Vision
3. **Study Modes**: Multiple learning approaches including gamified options
4. **Offline Support**: Full PWA functionality with local storage
5. **Progress Tracking**: Achievement system and learning analytics

### Study Modes
- **Flashcards**: Traditional spaced repetition
- **Multiple Choice**: AI-generated distractors
- **Streak Challenge**: Consecutive correct answers
- **Daily Practice**: Curated daily sessions
- **Time Attack**: Speed-based learning
- **Driving Game**: 3D immersive vocabulary practice

### Data Models
```typescript
// Card schema (shared/schema.ts)
cards: {
  id: serial,
  sourceText: text,
  targetText: text,
  explanation: text,
  sourceLang: text,
  targetLang: text,
  type: "word" | "sentence",
  category: text,
  categoryEmoji: text,
  learned: boolean,
  proficiency: integer,
  lastStudied: timestamp
}
```

## Data Flow

1. **Card Creation**: User input → Mistral AI translation → Local IndexedDB storage
2. **Image Scanning**: Camera/upload → Gemini Vision API → Card extraction → User review → Storage
3. **Study Sessions**: Local cards → Study mode selection → Progress tracking → Achievement evaluation
4. **Sync**: Currently offline-first, prepared for future PostgreSQL integration

## External Dependencies

### AI Services
- **Mistral AI**: Translation, memory aids, categorization (via Firebase Functions)
- **Google Gemini**: Image-to-text extraction and card generation (via Firebase Functions)
- **Firebase Functions**: Secure API key management and AI service integration

### Core Libraries
- React ecosystem (React, React DOM, React Query)
- UI components (Radix UI, Lucide icons)
- Database (Dexie for IndexedDB)
- 3D graphics (Three.js, GLTFLoader)
- PWA utilities (service worker, manifest)

### Development Tools
- TypeScript for type safety
- Vite for development and building
- ESLint/Prettier (implied by structure)
- Drizzle Kit for future database migrations

## Deployment Strategy

- **Platform**: Replit with Cloud Run deployment target
- **Development**: `npm run dev` starts Vite dev server on port 5000
- **Production**: `npm run build` creates optimized bundle, `npm start` serves production build
- **PWA**: Service worker provides offline functionality and app-like experience

## Recent Changes
- July 22, 2025: Enhanced Tech Tree and Export Functionality
  - **TECH TREE ORDERING**: Newest lessons now appear at the top of the tech tree for better user experience
  - **COMPREHENSIVE EXPORT**: Export function now includes flashcards, grammar lessons, scenarios, and cached MP3 audio files
  - **ENHANCED EXPORT VERSION**: Updated to export version 3.0 with content type statistics
  - **TRANSLATION DISPLAY FIX**: Improved grammar lesson translation extraction from multiple formats
  - **EXPORT INCLUDES AUDIO**: All cached audio files (base64 MP3s) are now included in export data
  - **SCENARIO ASSOCIATION**: Exported scenarios maintain association with their source cards for import
  - **TYPE SAFETY IMPROVEMENTS**: Fixed TypeScript type issues across components and database operations

## Changelog
- July 20, 2025: Fixed Sentence Builder Audio and UI Layout Issues
  - **SOUND PLAYBACK FIX**: Fixed TTS to play complete sentence from current scenario instead of individual card text
  - **CUSTOM TTS IMPLEMENTATION**: Added dedicated TTS handling for sentence builder with proper target language detection
  - **UI LAYOUT IMPROVEMENTS**: Moved control buttons (shuffle, play, sound, delete) outside and below the card
  - **FLEXIBLE GREY AREA**: Made target language translation area flexible height to accommodate multi-paragraph content
  - **PROGRESS BAR POSITIONING**: Confirmed progress bar positioned below entire sentence builder card
  - **DEBUG LOGGING**: Added comprehensive TTS debug logging to track audio generation and playback
  - **LANGUAGE MAPPING**: Fixed language code mapping for sentence builder scenarios
  - **GAP PARSING FIX**: Ensured "___ " text always converts to fillable gaps for users
  - **SOURCE LANGUAGE CLEANUP**: Removed gaps from source language translations (user shouldn't see gaps there)
  - **CATEGORY FILTERING FIX**: Fixed category filtering to only show scenarios from selected category throughout session
  - **TRUNCATED RESPONSE REPAIR**: Enhanced JSON repair for truncated Gemini scenario responses
- July 19, 2025: Enhanced Sentence Builder UI and Fixed Audio Issues
  - **PROGRESS BAR POSITIONING**: Moved progress bar below the sentence construction area for better visual hierarchy
  - **FIXED SOUND PLAYBACK**: Now plays the current card's word (sourceText) instead of complete sentence when sound is enabled
  - **FIXED LANGUAGE MAPPING**: Corrected scenarioSourceLang/scenarioTargetLang to use current card's language settings instead of preferences
  - **WINDOW SIZE STABILITY**: Fixed sentence construction and word bank areas to use fixed heights to prevent resizing
  - **CURRENT CARD INTEGRATION**: Added currentCardText prop to sentence builder for proper audio playback
  - **IMPROVED UX**: Consistent component sizing and proper audio feedback for language learning
- July 15, 2025: Implemented Google Cloud Text-to-Speech integration replacing Gemini TTS
  - **GOOGLE CLOUD TTS**: Replaced Gemini text-based TTS with actual Google Cloud Text-to-Speech API
  - **REAL AUDIO GENERATION**: Now generates and plays actual MP3 audio files from text
  - **LANGUAGE CODE MAPPING**: Added comprehensive language code mapping to BCP-47 format
  - **FIREBASE REGION FIX**: Fixed Firebase Functions region configuration for proper CORS handling
  - **AUDIO CACHING**: Enhanced audio caching system for base64 audio content
  - **PLAYBACK IMPROVEMENTS**: Improved audio playback with proper error handling and user feedback
  - **CLIENT-SIDE UPDATES**: Updated client-side API calls to use new audio generation format
  - **QUALITY ENHANCEMENT**: Replaced text descriptions with actual speech synthesis
- July 15, 2025: Implemented comprehensive API statistics system and TTS routing through Gemini
  - **API STATISTICS**: Added comprehensive tracking for all API calls (AI Translations, TTS, Image Processing, Scenario Generation)
  - **TTS ROUTING**: Implemented TTS routing through Gemini API instead of separate Google TTS service
  - **GEMINI TTS**: Added getGeminiTTS Firebase Function for pronunciation and audio descriptions
  - **LANGUAGE MAPPING FIX**: Fixed sentence builder "add to vocabulary" language mapping issue
  - **SCENARIO TRACKING**: Added API call tracking for scenario generation to monitor usage
  - **CENTRALIZED STATS**: Created unified API usage statistics display in stats page
  - **FUTURE DAILY LIMITS**: Statistics foundation prepared for implementing daily API limits
- July 15, 2025: Enhanced Firebase Functions with robust validation and error handling
  - **INPUT VALIDATION**: Added comprehensive validation for all function parameters
  - **IMPROVED ERROR HANDLING**: Detailed error capture from upstream APIs with full error messages
  - **ENHANCED LOGGING**: Added structured logging for JSON parsing failures and API errors
  - **RESPONSE VALIDATION**: Added validation for Gemini API response structure
  - **PROPER ERROR TYPES**: Using appropriate HttpsError types (invalid-argument, failed-precondition, internal)
  - **CONFIGURATION VALIDATION**: Added checks for missing API keys during runtime
  - **DEBUGGING IMPROVEMENTS**: Better error messages and logging for troubleshooting
- July 15, 2025: Refactored Firebase Functions architecture for improved security
  - **BREAKING CHANGE**: Removed `accessMySecureKeys` function - API keys no longer exposed to client
  - **SECURITY IMPROVEMENT**: Converted from `onRequest` to `onCall` functions for better security
  - **CLIENT UPDATES**: Updated Firebase SDK integration to use `httpsCallable` for function calls
  - **SIMPLIFIED ARCHITECTURE**: API keys now stay securely on server-side in Firebase Functions
  - **REMOVED CORS COMPLEXITY**: onCall functions handle CORS automatically
  - **ENHANCED ERROR HANDLING**: Using Firebase Functions HttpsError for proper error management
  - **STREAMLINED API**: Client now only calls specific functions (getMistralTranslation, getGeminiResponse)
  - **IMPROVED SECURITY**: No direct API key exposure to client-side code
  - **BETTER PERFORMANCE**: Reduced HTTP overhead with direct function calls
- July 15, 2025: Integrated Firebase Functions for secure API key management
  - Added Firebase SDK integration with project configuration
  - Created Firebase Functions for Mistral AI translations and Gemini responses
  - Implemented secure API key storage using Firebase Functions config
  - Updated client-side API layer to use Firebase Functions instead of local server
  - Added CORS support for web app access to Firebase Functions
  - Created Firebase connection test component for verification
  - Enhanced security by centralizing API key management in Firebase cloud environment
- July 11, 2025: Implemented intelligent API optimization system
  - Added `hasScenario` boolean field to prevent redundant API calls to Gemini
  - Enhanced database schema to version 4 with scenario tracking flag
  - Implemented automatic migration to update existing cards with scenario flags
  - Filtering system now prevents sending words that already have scenarios to Gemini
  - Comprehensive logging system to track API usage and scenario attribution
  - Significant reduction in API costs by avoiding duplicate scenario generation
  - Fixed particle animation issue - last card in flashcard mode shows success screen immediately
- July 10, 2025: Implemented scenario caching system for Sentence Builder
  - Added scenario caching to database schema with `cachedScenarios` array field
  - Implemented offline-first approach - cached scenarios load immediately on startup
  - Background fetching of new scenarios for words without cached content
  - Scenarios are attached to specific words in user's databank for faster retrieval
  - Support for future multiple scenarios per word (currently limited to one per word)
  - Enhanced IndexedDB schema to version 3 with scenario storage capabilities
  - Users no longer wait for API calls on most sentence builder sessions
- July 7, 2025: Major UX improvements and bug fixes
  - Fixed onboarding cache persistence - language preferences now properly saved on first setup
  - Enhanced achievement notifications with smooth 4-second progress bar animation that auto-dismisses
  - Fixed flashcard victory screen to show properly when last card is marked as learned
  - Improved memory aids to focus on target language explanations (not source language)
  - Updated service worker cache to include all assets (flash-hour.png, clippy flags, etc.)
  - Added word-only filtering for Multiple Choice, Flash Hour, Daily Practice, and Time Attack modes
  - Created comprehensive 50-page application documentation for detailed app understanding
  - Added comprehensive marketing strategy document with revenue models and user targeting
- June 25, 2025: Enhanced driving game with car-specific speeds and improved animations
  - Implemented different speed multipliers for each car type (vintage car 50% faster, racing car 40% faster, etc.)
  - Fixed score/card display boxes to show correct numbers for selected challenge
  - Improved training mode animations with smooth slide-in effects
  - Fixed card status update issue - cards now refresh immediately after driving game completion
  - Enhanced game ending logic to properly complete after all selected cards
  - Removed car auto-reset behavior - car now stays in chosen lane after passing signs
- June 24, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.