import { NextResponse } from 'next/server';

const HF_BASE = 'https://api-inference.huggingface.co/models';

export async function POST(request) {
  try {
    const { prompt, model, negativePrompt, hfToken } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const modelId = model || 'black-forest-labs/FLUX.1-schnell';
    const headers = { 'Content-Type': 'application/json' };
    if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`;

    const body = { inputs: prompt, parameters: {} };
    if (negativePrompt) body.parameters.negative_prompt = negativePrompt;

    const response = await fetch(`${HF_BASE}/${modelId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `HuggingFace: ${response.status} — ${text.slice(0, 200)}` },
        { status: response.status }
      );
    }

    // HF returns raw image bytes — convert to base64 data URL
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const dataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({ url: dataUrl });
  } catch (err) {
    console.error('[hf-proxy]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
