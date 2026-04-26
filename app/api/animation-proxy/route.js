import { NextResponse } from 'next/server';

/**
 * Animation proxy: generates N frames from Pollinations.ai using different seeds.
 * Client will stitch them into a video using canvas + MediaRecorder.
 */
export async function POST(request) {
  try {
    const { prompt = '', frames = 5 } = await request.json();

    if (!prompt.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const count = Math.min(Math.max(frames, 4), 12);
    console.log('[animation-proxy] generating', count, 'frames for:', prompt.slice(0, 60));

    const base = 'https://image.pollinations.ai/prompt';
    const encoded = encodeURIComponent(prompt.trim());
    const frameUrls = [];

    for (let i = 0; i < count; i++) {
      const seed = Math.floor(Math.random() * 99999);
      const url = `${base}/${encoded}?width=768&height=432&nologo=true&seed=${seed}`;
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(45_000) });
        if (!r.ok) throw new Error(`Frame ${i} failed: ${r.status}`);
        const buf = await r.arrayBuffer();
        const b64 = Buffer.from(buf).toString('base64');
        const ct = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
        frameUrls.push(`data:${ct};base64,${b64}`);
        console.log(`[animation-proxy] frame ${i + 1}/${count} ready`);
      } catch (e) {
        console.warn(`[animation-proxy] frame ${i} skipped:`, e.message);
        // skip failed frames, continue
      }
      // Small delay between requests to avoid rate limiting
      if (i < count - 1) await new Promise(r => setTimeout(r, 800));
    }

    if (frameUrls.length < 2) throw new Error('Too few frames generated. Try again.');
    console.log('[animation-proxy] ✓', frameUrls.length, 'frames ready');

    return NextResponse.json({ frames: frameUrls });

  } catch (err) {
    console.error('[animation-proxy] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
