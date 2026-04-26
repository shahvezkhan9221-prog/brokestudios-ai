/**
 * freeModels.js — Free model definitions
 *
 * Pollinations.ai models (no key needed):
 *   flux, flux-realism, flux-cablyai, flux-anime, flux-3d, turbo, gptimage
 *
 * Hugging Face models (free HF token):
 *   FLUX.1-schnell, stable-diffusion-xl-base-1.0, etc.
 *
 * AI Horde models (anonymous key):
 *   stable_diffusion, dreamshaper_8, etc.
 */

// ─── Aspect ratio → width/height map (for Pollinations) ────────────────────
export const AR_TO_DIMS = {
  '1:1':  { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768  },
  '9:16': { width: 768,  height: 1344 },
  '4:3':  { width: 1152, height: 896  },
  '3:4':  { width: 896,  height: 1152 },
  '3:2':  { width: 1216, height: 832  },
  '2:3':  { width: 832,  height: 1216 },
  '21:9': { width: 1536, height: 640  },
};

// ─── Text-to-Image models ────────────────────────────────────────────────────
export const freeT2IModels = [
  {
    id: 'flux',
    name: 'FLUX (XBOT)',
    provider: 'pollinations',
    pollinationsModel: 'flux',
    inputs: {
      aspect_ratio: {
        enum: Object.keys(AR_TO_DIMS),
        default: '1:1',
      },
    },
    badge: '⚡ FREE',
    description: 'Best quality. State-of-the-art FLUX model via Pollinations.',
  },
  {
    id: 'flux-realism',
    name: 'FLUX Realism (XBOT)',
    provider: 'pollinations',
    pollinationsModel: 'flux-realism',
    inputs: {
      aspect_ratio: {
        enum: Object.keys(AR_TO_DIMS),
        default: '1:1',
      },
    },
    badge: '⚡ FREE',
    description: 'Photorealistic FLUX variant.',
  },
  {
    id: 'flux-anime',
    name: 'FLUX Anime (XBOT)',
    provider: 'pollinations',
    pollinationsModel: 'flux-anime',
    inputs: {
      aspect_ratio: {
        enum: Object.keys(AR_TO_DIMS),
        default: '1:1',
      },
    },
    badge: '⚡ FREE',
    description: 'Anime-style image generation.',
  },
  {
    id: 'flux-3d',
    name: 'FLUX 3D (XBOT)',
    provider: 'pollinations',
    pollinationsModel: 'flux-3d',
    inputs: {
      aspect_ratio: {
        enum: Object.keys(AR_TO_DIMS),
        default: '1:1',
      },
    },
    badge: '⚡ FREE',
    description: '3D render style images.',
  },
  {
    id: 'turbo',
    name: 'Turbo SD (XBOT)',
    provider: 'pollinations',
    pollinationsModel: 'turbo',
    inputs: {
      aspect_ratio: {
        enum: Object.keys(AR_TO_DIMS),
        default: '1:1',
      },
    },
    badge: '⚡ FREE',
    description: 'Fast Stable Diffusion Turbo.',
  },
  {
    id: 'gptimage',
    name: 'GPT Image (XBOT)',
    provider: 'pollinations',
    pollinationsModel: 'gptimage',
    inputs: {
      aspect_ratio: {
        enum: ['1:1', '16:9', '9:16'],
        default: '1:1',
      },
    },
    badge: '⚡ FREE',
    description: 'GPT-based image generation.',
  },
  // ── Hugging Face models (requires free HF token) ──
  {
    id: 'hf-flux-schnell',
    name: 'FLUX.1 Schnell (HuggingFace)',
    provider: 'huggingface',
    hfModel: 'black-forest-labs/FLUX.1-schnell',
    inputs: {
      aspect_ratio: {
        enum: Object.keys(AR_TO_DIMS),
        default: '1:1',
      },
    },
    badge: '🤗 HF FREE',
    description: 'Fastest FLUX model. Free HF token required.',
    requiresHFToken: true,
  },
  {
    id: 'hf-sdxl',
    name: 'Stable Diffusion XL (HuggingFace)',
    provider: 'huggingface',
    hfModel: 'stabilityai/stable-diffusion-xl-base-1.0',
    inputs: {
      aspect_ratio: {
        enum: Object.keys(AR_TO_DIMS),
        default: '1:1',
      },
    },
    badge: '🤗 HF FREE',
    description: 'Stable Diffusion XL. Free HF token required.',
    requiresHFToken: true,
  },
  {
    id: 'hf-dreamshaper',
    name: 'DreamShaper (HuggingFace)',
    provider: 'huggingface',
    hfModel: 'Lykon/dreamshaper-8',
    inputs: {
      aspect_ratio: {
        enum: ['1:1', '16:9', '9:16', '3:4', '4:3'],
        default: '1:1',
      },
    },
    badge: '🤗 HF FREE',
    description: 'Versatile dreamy art style. Free HF token required.',
    requiresHFToken: true,
  },
  // ── AI Horde (crowdsourced, anonymous) ──
  {
    id: 'horde-sd',
    name: 'Stable Diffusion (AI Horde)',
    provider: 'horde',
    hordeModel: 'stable_diffusion',
    inputs: {
      aspect_ratio: {
        enum: ['1:1', '16:9', '9:16'],
        default: '1:1',
      },
    },
    badge: '🌐 HORDE FREE',
    description: 'Crowdsourced SD. Slower but free. No key needed.',
  },
];

// ─── Helper lookups ───────────────────────────────────────────────────────────

export function getFreeModelById(id) {
  return freeT2IModels.find((m) => m.id === id);
}

export function getAspectRatiosForFreeModel(id) {
  const m = getFreeModelById(id);
  return m?.inputs?.aspect_ratio?.enum || ['1:1'];
}
