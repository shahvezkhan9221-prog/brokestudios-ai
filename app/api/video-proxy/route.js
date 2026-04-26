import { NextResponse } from 'next/server';

/**
 * Video proxy — 3-tier pipeline (best quality first):
 *
 *  Tier 1: WaveSpeed.ai + Wan 2.1 (real AI video, free credits, requires API key)
 *  Tier 2: multimodalart/stable-video-diffusion HF Space (free, no key, quota-limited)
 *  Tier 3: Client signals to fallback to Ken Burns (handled in FreeVideoStudio)
 *
 * WaveSpeed API: https://api.wavespeed.ai/api/v3/wavespeed-ai/wan2.1-t2v-480p
 */

const SVD_BASE = 'https://multimodalart-stable-video-diffusion.hf.space';
const WAVESPEED_BASE = 'https://api.wavespeed.ai/api/v3';

function randomSessionHash() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// ── WaveSpeed helpers ─────────────────────────────────────────────────────────

/**
 * Submit a Wan 2.1 text-to-video job to WaveSpeed and poll until done.
 * Returns the CDN video URL string.
 */
async function generateWithWaveSpeed({ prompt, apiKey, duration = '5', steps = 20, timeoutMs = 300_000 }) {
  console.log('[video-proxy] 🌊 WaveSpeed: submitting Wan 2.7 job…');

  const submitResp = await fetch(`${WAVESPEED_BASE}/alibaba/wan-2.7/text-to-video`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      duration: parseInt(duration, 10),
      seed: Math.floor(Math.random() * 2 ** 31),
      enable_prompt_expansion: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!submitResp.ok) {
    const body = await submitResp.text();
    throw new Error(`WaveSpeed submit failed (${submitResp.status}): ${body.slice(0, 300)}`);
  }

  const submitData = await submitResp.json();
  const taskId = submitData?.data?.id;
  if (!taskId) throw new Error(`WaveSpeed: no task ID in response: ${JSON.stringify(submitData).slice(0, 200)}`);
  console.log('[video-proxy] 🌊 WaveSpeed task:', taskId);

  // Poll for completion
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));

    const pollResp = await fetch(`${WAVESPEED_BASE}/predict/${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!pollResp.ok) {
      console.warn('[video-proxy] 🌊 Poll error:', pollResp.status);
      continue;
    }

    const pollData = await pollResp.json();
    const status = pollData?.data?.status;
    console.log('[video-proxy] 🌊 WaveSpeed status:', status);

    if (status === 'completed') {
      const videoUrl = pollData?.data?.outputs?.[0];
      if (!videoUrl) throw new Error('WaveSpeed completed but no output URL');
      console.log('[video-proxy] 🌊 WaveSpeed video URL:', videoUrl.slice(0, 80));
      return videoUrl;
    }

    if (status === 'failed') {
      const reason = pollData?.data?.error || JSON.stringify(pollData).slice(0, 200);
      throw new Error(`WaveSpeed generation failed: ${reason}`);
    }
  }

  throw new Error('WaveSpeed timed out after 5 minutes');
}

// ── Pollinations image helper ─────────────────────────────────────────────────

async function generateImageBase64(prompt) {
  const encoded = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=576&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;
  console.log('[video-proxy] 🎨 Pollinations: fetching image…');

  const resp = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!resp.ok) throw new Error(`Pollinations image failed: ${resp.status}`);

  const buffer = await resp.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const ct = resp.headers.get('content-type') || 'image/jpeg';
  const dataUrl = `data:${ct.split(';')[0]};base64,${base64}`;
  console.log('[video-proxy] 🎨 Image ready, size:', Math.round(buffer.byteLength / 1024), 'KB');
  return dataUrl;
}

// ── SVD HuggingFace Space helper ──────────────────────────────────────────────

async function animateWithSVD({ imageDataUrl, seed, motionBucket, fps, timeoutMs }) {
  const sessionHash = randomSessionHash();

  const imagePayload = {
    url: imageDataUrl,
    mime_type: 'image/jpeg',
    is_stream: false,
    meta: { _type: 'gradio.FileData' },
  };

  const joinResp = await fetch(`${SVD_BASE}/gradio_api/queue/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [imagePayload, seed, true, motionBucket, fps],
      api_name: '/video',
      fn_index: 1,
      session_hash: sessionHash,
    }),
  });

  if (!joinResp.ok) {
    const t = await joinResp.text();
    throw new Error(`SVD queue join failed (${joinResp.status}): ${t.slice(0, 200)}`);
  }

  const { event_id } = await joinResp.json();
  console.log('[video-proxy] 🤗 SVD queued, event_id:', event_id);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const sseResp = await fetch(
      `${SVD_BASE}/gradio_api/queue/data?session_hash=${sessionHash}`,
      { signal: controller.signal }
    );
    if (!sseResp.ok) throw new Error(`SVD SSE failed: ${sseResp.status}`);

    const reader = sseResp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) throw new Error('SSE stream ended without result');

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const rawJson = line.slice(6).trim();
        if (!rawJson) continue;

        let event;
        try { event = JSON.parse(rawJson); } catch { continue; }

        const msg = event.msg;
        if (msg) console.log('[video-proxy] 🤗 SVD event:', msg, event.rank != null ? `rank=${event.rank}` : '');

        if (msg === 'queue_full') throw new Error('SVD queue is full, try again in a moment.');

        if (msg === 'process_completed') {
          if (!event.success) {
            const errMsg = event.output?.error || JSON.stringify(event.output).slice(0, 200);
            // Surface quota errors distinctly so the client can detect them
            if (errMsg.includes('GPU quota') || errMsg.includes('exceeded') || errMsg.includes('quota')) {
              throw new Error(`GPU quota exceeded: ${errMsg}`);
            }
            throw new Error(`SVD generation failed: ${errMsg}`);
          }
          return event.output;
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    prompt = '',
    wavespeedKey = '',
    seed = Math.floor(Math.random() * 2 ** 31),
    motionBucket = 127,
    fps = 6,
  } = body;

  if (!prompt.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  console.log('[video-proxy] === Video Pipeline Start ===');
  console.log('[video-proxy] prompt:', prompt.slice(0, 80));
  console.log('[video-proxy] WaveSpeed key present:', !!wavespeedKey?.trim());

  // ── Tier 1: WaveSpeed Wan 2.1 (real AI video) ──────────────────────────────
  if (wavespeedKey?.trim()) {
    console.log('[video-proxy] 🌊 Attempting WaveSpeed Wan 2.1…');
    try {
      const videoUrl = await generateWithWaveSpeed({
        prompt: prompt.trim(),
        apiKey: wavespeedKey.trim(),
        duration: '5',
        steps: 20,
        timeoutMs: 300_000,
      });

      console.log('[video-proxy] 🌊 Downloading WaveSpeed video…');
      const videoResp = await fetch(videoUrl, { signal: AbortSignal.timeout(90_000) });
      if (!videoResp.ok) throw new Error(`Failed to download WaveSpeed video: ${videoResp.status}`);

      const contentType = videoResp.headers.get('content-type') || 'video/mp4';
      const buf = await videoResp.arrayBuffer();
      const dataUrl = `data:${contentType.split(';')[0]};base64,${Buffer.from(buf).toString('base64')}`;

      console.log('[video-proxy] ✅ WaveSpeed Wan 2.1 ready,', Math.round(buf.byteLength / 1024), 'KB');
      return NextResponse.json({ url: dataUrl, contentType, tier: 'wavespeed' });

    } catch (wsErr) {
      // If it's auth/billing, surface the error — don't silently fall through
      const wsMsg = wsErr.message || '';
      const isAuth = wsMsg.includes('401') || wsMsg.includes('403') || wsMsg.includes('unauthorized') || wsMsg.includes('Unauthorized');
      const isBilling = wsMsg.includes('402') || wsMsg.includes('credit') || wsMsg.includes('balance') || wsMsg.includes('quota');

      if (isAuth) {
        console.error('[video-proxy] 🌊 WaveSpeed auth error:', wsMsg);
        return NextResponse.json({ error: `WaveSpeed API key invalid or unauthorized. Check your key at wavespeed.ai. (${wsMsg.slice(0, 120)})` }, { status: 401 });
      }
      if (isBilling) {
        console.error('[video-proxy] 🌊 WaveSpeed billing/quota error:', wsMsg);
        return NextResponse.json({ error: `WaveSpeed credits exhausted. Top up at wavespeed.ai. (${wsMsg.slice(0, 120)})` }, { status: 402 });
      }

      // Transient error — fall through to SVD
      console.warn('[video-proxy] 🌊 WaveSpeed transient error, falling back to SVD:', wsMsg);
    }
  }

  // ── Tier 2: SVD HuggingFace Space (free, quota-limited) ────────────────────
  console.log('[video-proxy] 🤗 Trying SVD HF Space…');
  try {
    const imageDataUrl = await generateImageBase64(prompt.trim());

    const svdOutput = await animateWithSVD({
      imageDataUrl,
      seed,
      motionBucket,
      fps,
      timeoutMs: 300_000,
    });

    const resultData = svdOutput?.data?.[0];
    const videoData = resultData?.video ?? resultData;
    if (!videoData) throw new Error('No video returned from SVD space');

    let videoUrl = videoData.url;
    if (!videoUrl && videoData.path) videoUrl = `${SVD_BASE}/gradio_api/file=${videoData.path}`;
    if (!videoUrl) throw new Error('Could not determine video URL from SVD response');
    if (videoUrl.startsWith('/')) videoUrl = SVD_BASE + videoUrl;

    console.log('[video-proxy] 🤗 Downloading SVD video…');
    const videoResp = await fetch(videoUrl, { signal: AbortSignal.timeout(60_000) });
    if (!videoResp.ok) throw new Error(`Failed to download SVD video: ${videoResp.status}`);

    const contentType = videoResp.headers.get('content-type') || 'video/mp4';
    const buf = await videoResp.arrayBuffer();
    const dataUrl = `data:${contentType.split(';')[0]};base64,${Buffer.from(buf).toString('base64')}`;

    console.log('[video-proxy] ✅ SVD video ready,', Math.round(buf.byteLength / 1024), 'KB');
    return NextResponse.json({ url: dataUrl, contentType, tier: 'svd' });

  } catch (svdErr) {
    if (svdErr.name === 'AbortError' || svdErr.name === 'TimeoutError') {
      // Timeout on SVD is always caused by GPU quota exhaustion — signal fallback
      return NextResponse.json({ error: 'SVD timed out (GPU quota likely exhausted).', isQuotaError: true }, { status: 504 });
    }
    const svdMsg = svdErr.message || '';
    const isQuota = svdMsg.includes('GPU quota') || svdMsg.includes('exceeded') || svdMsg.includes('quota') || svdMsg.includes('queue_full');
    console.error('[video-proxy] 🤗 SVD error (isQuota=' + isQuota + '):', svdMsg);
    // Return isQuotaError so client can gracefully fall back to Ken Burns
    return NextResponse.json({ error: svdMsg, isQuotaError: isQuota }, { status: 500 });
  }
}
