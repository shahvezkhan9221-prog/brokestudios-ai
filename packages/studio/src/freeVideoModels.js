/**
 * freeVideoModels.js
 *
 * Tier 1 — WaveSpeed.ai (real Wan 2.1 video, requires free API key)
 * Tier 2 — HuggingFace SVD Space (free, quota-limited, no key needed)
 * Tier 3 — Ken Burns animation (always works, client-side fallback)
 */

export const freeVideoModels = [
  {
    id: 'wan2.1-480p',
    name: 'Wan 2.1',
    space: 'wavespeed',
    provider: 'wavespeed',
    badge: '🌊 WaveSpeed',
    description: 'Real AI video · Wan 2.1 480p · Free credits on signup at wavespeed.ai',
    resolution: '848×480',
    requiresKey: true,
    keyLabel: 'WaveSpeed API Key',
    outputFormat: 'video/mp4',
    maxDuration: 5,
  },
  {
    id: 'zeroscope-v2',
    name: 'Zeroscope V2',
    space: 'zeroscope-v2',
    spaceSlug: 'hysts-zeroscope-v2',
    provider: 'hf-space',
    badge: '🤗 HF Space',
    description: 'Free SVD via HuggingFace Space · No key needed · Quota limited',
    resolution: '576×320',
    requiresKey: false,
    outputFormat: 'video/mp4',
    maxDuration: 4,
    defaultNumFrames: 24,
    defaultNumSteps: 25,
  },
];

export function getFreeVideoModelById(id) {
  return freeVideoModels.find((m) => m.id === id);
}
