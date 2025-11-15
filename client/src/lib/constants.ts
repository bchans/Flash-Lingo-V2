export const LANGUAGES = [
  { value: "en", label: "🇺🇸 English", hasCustomFlag: true, flagImage: "/clippy-USA-flag.png" },
  { value: "es", label: "🇪🇸 Spanish", hasCustomFlag: true, flagImage: "/clippy-spanish-flag.png" },
  { value: "fr", label: "🇫🇷 French", hasCustomFlag: true, flagImage: "/clippy-french-flag.png" },
  { value: "de", label: "🇩🇪 German", hasCustomFlag: true, flagImage: "/clippy-german-flag.png" },
  { value: "it", label: "🇮🇹 Italian", hasCustomFlag: true, flagImage: "/clippy-italian-flag.png" },
  { value: "pt", label: "🇵🇹 Portuguese", hasCustomFlag: true, flagImage: "/clippy-portugese-flag.png" },
  { value: "ru", label: "🇷🇺 Russian", hasCustomFlag: true, flagImage: "/clippy-russian-flag.png" },
  { value: "zh", label: "🇨🇳 Chinese", hasCustomFlag: true, flagImage: "/clippy-chinese-flag.png" },
  { value: "ja", label: "🇯🇵 Japanese", hasCustomFlag: true, flagImage: "/clippy-japanese-flag.png" },
  { value: "ko", label: "🇰🇷 Korean", hasCustomFlag: true, flagImage: "/clippy-korean-flag.png" },
  { value: "vi", label: "🇻🇳 Vietnamese", hasCustomFlag: true, flagImage: "/clippy-vietnamese-flag.png" }
] as const;

export function getLanguageLabel(code: string) {
  const language = LANGUAGES.find(lang => lang.value === code);
  if (!language) {
    console.warn(`Language code ${code} not found`);
    return 'Unknown Language';
  }
  return language.label;
}