import { NextResponse } from 'next/server';

const POLLINATIONS_BASE = 'https://image.pollinations.ai';

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request) {
  try {
    const {
      prompt = '',
      model = 'flux',
      width = 1024,
      height = 1024,
      enhance = false,
    } = await request.json();

    if (!prompt.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const seed = Math.floor(Math.random() * 2 ** 31);
    const encodedPrompt = encodeURIComponent(prompt);
    const url = new URL(`${POLLINATIONS_BASE}/prompt/${encodedPrompt}`);
    url.searchParams.set('model', model);
    url.searchParams.set('width', String(width));
    url.searchParams.set('height', String(height));
    url.searchParams.set('seed', String(seed));
    url.searchParams.set('nologo', 'true');
    url.searchParams.set('enhance', String(enhance));

    console.log('[pollinations-proxy] →', url.toString());

    // Try up to 2 times with 120s each
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const imgRes = await fetchWithTimeout(
          url.toString(),
          { headers: { 'User-Agent': 'open-generative-ai/1.0' } },
          120_000  // 120 second timeout
        );

        if (!imgRes.ok) {
          const text = await imgRes.text();
          lastError = `Pollinations: ${imgRes.status} — ${text.slice(0, 100)}`;
          console.warn(`[pollinations-proxy] attempt ${attempt} failed:`, lastError);
          continue;
        }

        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        if (!contentType.startsWith('image/')) {
          const text = await imgRes.text();
          lastError = `Non-image response: ${contentType} — ${text.slice(0, 100)}`;
          console.warn(`[pollinations-proxy] attempt ${attempt} non-image:`, lastError);
          continue;
        }

        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const dataUrl = `data:${contentType};base64,${base64}`;
        console.log('[pollinations-proxy] ✓ success on attempt', attempt);
        return NextResponse.json({ url: dataUrl, seed });

      } catch (err) {
        lastError = err.name === 'AbortError' ? 'Timed out after 120s' : err.message;
        console.warn(`[pollinations-proxy] attempt ${attempt} error:`, lastError);
      }
    }

    return NextResponse.json({ error: lastError || 'Pollinations failed' }, { status: 502 });

  } catch (err) {
    console.error('[pollinations-proxy] unexpected:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
