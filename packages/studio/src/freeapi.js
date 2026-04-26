/**
 * freeapi.js — Free AI generation client
 *
 * Image: Pollinations.ai — proxied via /api/pollinations-proxy (server-side, no CORS)
 * HuggingFace — proxied via /api/hf-proxy
 * AI Horde — proxied via /api/horde-proxy
 */

// ─── Pollinations.ai (via server proxy) ──────────────────────────────────────

/**
 * Generate via Pollinations.ai via server proxy.
 * ✅ Returns base64 data URL — permanent, no rate-limit on re-load.
 */
export async function pollinationsGenerateImage(params) {
  const { prompt = '', model = 'flux', width = 1024, height = 1024, enhance = false } = params;

  const response = await fetch('/api/pollinations-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, width, height, enhance }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Pollinations error: ${response.status}`);
  if (!data.url) throw new Error('No image returned from Pollinations');
  return { url: data.url, provider: 'pollinations' };
}

// ─── Hugging Face (via server proxy) ─────────────────────────────────────────

export async function hfGenerateImage(params) {
  const { prompt = '', model = 'black-forest-labs/FLUX.1-schnell', negativePrompt = '', hfToken = '' } = params;

  const response = await fetch('/api/hf-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, negativePrompt, hfToken }),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 503) throw new Error('Model is loading on HuggingFace. Wait 20-30s and retry.');
    throw new Error(`HuggingFace error: ${response.status} — ${text.slice(0, 120)}`);
  }

  const data = await response.json();
  return { url: data.url, provider: 'huggingface' };
}

// ─── AI Horde (via server proxy) ─────────────────────────────────────────────

export async function hordeGenerateImage(params) {
  const {
    prompt = '',
    model = 'stable_diffusion',
    width = 512,
    height = 512,
    steps = 28,
    hordeKey = '0000000000',
  } = params;

  const response = await fetch('/api/horde-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, width: Math.min(width, 512), height: Math.min(height, 512), steps: Math.min(steps, 28), hordeKey }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Horde error: ${response.status} — ${text.slice(0, 120)}`);
  }

  const data = await response.json();
  return { url: data.url, provider: 'horde' };
}

// ─── Unified generate ────────────────────────────────────────────────────────

export async function generateImageFree(params) {
  const { provider = 'pollinations', model, prompt, ...rest } = params;
  if (provider === 'huggingface') return hfGenerateImage({ prompt, model, ...rest });
  if (provider === 'horde') return hordeGenerateImage({ prompt, model, ...rest });
  return pollinationsGenerateImage({ prompt, model, ...rest });
}

export function uploadFileFree(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

export async function getUserBalanceFree() {
  return { balance: '∞ FREE' };
}
