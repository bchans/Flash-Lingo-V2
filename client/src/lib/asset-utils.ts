/**
 * Utility for handling asset paths with proper base URL support for GitHub Pages
 */

/**
 * Get the correct asset URL accounting for the base path (e.g., /Flash-Lingo-V2/)
 * @param path - The asset path relative to the public directory (e.g., "car.glb" or "buildings/fence.glb")
 * @returns The full path with base URL prepended
 */
export function getAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  // Remove leading slash from path if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${cleanPath}`.replace(/\/\//g, '/');
}

