// Helper to get base path-aware asset URLs
const getAssetUrl = (path: string) => {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path}`.replace(/\/\//g, '/');
};

export const LANGUAGES = [
  { value: "en", label: "🇺🇸 English", hasCustomFlag: true, flagImage: getAssetUrl("clippy-USA-flag.png") },
  { value: "es", label: "🇪🇸 Spanish", hasCustomFlag: true, flagImage: getAssetUrl("clippy-spanish-flag.png") },
  { value: "fr", label: "🇫🇷 French", hasCustomFlag: true, flagImage: getAssetUrl("clippy-french-flag.png") },
  { value: "de", label: "🇩🇪 German", hasCustomFlag: true, flagImage: getAssetUrl("clippy-german-flag.png") },
  { value: "it", label: "🇮🇹 Italian", hasCustomFlag: true, flagImage: getAssetUrl("clippy-italian-flag.png") },
  { value: "pt", label: "🇵🇹 Portuguese", hasCustomFlag: true, flagImage: getAssetUrl("clippy-portugese-flag.png") },
  { value: "ru", label: "🇷🇺 Russian", hasCustomFlag: true, flagImage: getAssetUrl("clippy-russian-flag.png") },
  { value: "zh", label: "🇨🇳 Chinese", hasCustomFlag: true, flagImage: getAssetUrl("clippy-chinese-flag.png") },
  { value: "ja", label: "🇯🇵 Japanese", hasCustomFlag: true, flagImage: getAssetUrl("clippy-japanese-flag.png") },
  { value: "ko", label: "🇰🇷 Korean", hasCustomFlag: true, flagImage: getAssetUrl("clippy-korean-flag.png") },
  { value: "vi", label: "🇻🇳 Vietnamese", hasCustomFlag: true, flagImage: getAssetUrl("clippy-vietnamese-flag.png") }
] as const;

export function getLanguageLabel(code: string) {
  const language = LANGUAGES.find(lang => lang.value === code);
  if (!language) {
    console.warn(`Language code ${code} not found`);
    return 'Unknown Language';
  }
  return language.label;
}