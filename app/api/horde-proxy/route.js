import { NextResponse } from 'next/server';

const HORDE_BASE = 'https://aihorde.net/api/v2';

export async function POST(request) {
  try {
    const {
      prompt,
      model = 'stable_diffusion',
      width = 512,
      height = 512,
      steps = 28,
      hordeKey = '0000000000',
    } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    // ─── Submit job ────────────────────────────────────────────────────────
    const submitRes = await fetch(`${HORDE_BASE}/generate/async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': hordeKey,
        'Client-Agent': 'open-generative-ai:1.0:github.com',
      },
      body: JSON.stringify({
        prompt,
        params: {
          width: Math.min(width, 512),
          height: Math.min(height, 512),
          steps: Math.min(steps, 28),
          n: 1,
          sampler_name: 'k_euler_a',
        },
        models: [model],
        r2: false,
      }),
    });

    if (!submitRes.ok) {
      const text = await submitRes.text();
      return NextResponse.json(
        { error: `Horde submit: ${submitRes.status} — ${text.slice(0, 200)}` },
        { status: submitRes.status }
      );
    }

    const { id } = await submitRes.json();
    if (!id) {
      return NextResponse.json({ error: 'Horde returned no job ID' }, { status: 500 });
    }

    // ─── Poll for result (max 10 min) ──────────────────────────────────────
    for (let attempt = 0; attempt < 200; attempt++) {
      await new Promise(r => setTimeout(r, 3000));

      const checkRes = await fetch(`${HORDE_BASE}/generate/check/${id}`, {
        headers: { 'Client-Agent': 'open-generative-ai:1.0:github.com' },
      });
      if (!checkRes.ok) continue;
      const check = await checkRes.json();

      if (check.faulted) {
        return NextResponse.json({ error: 'Horde: job faulted' }, { status: 500 });
      }

      if (check.done) {
        const statusRes = await fetch(`${HORDE_BASE}/generate/status/${id}`, {
          headers: { 'Client-Agent': 'open-generative-ai:1.0:github.com' },
        });
        const status = await statusRes.json();
        const imgUrl = status.generations?.[0]?.img;

        if (!imgUrl) {
          return NextResponse.json({ error: 'Horde: no image in result' }, { status: 500 });
        }

        return NextResponse.json({ url: imgUrl });
      }
    }

    return NextResponse.json({ error: 'Horde: timed out after 10 minutes' }, { status: 504 });
  } catch (err) {
    console.error('[horde-proxy]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
