"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { freeVideoModels, getFreeVideoModelById } from "../freeVideoModels.js";

const PERSIST_KEY = "free_video_studio";
const HISTORY_KEY = "free_video_history";

const TIPS = [
  "Cinematic drone shot of a futuristic city at night, neon lights",
  "Slow motion waterfall in a lush tropical forest",
  "A robot dancing on a rooftop at sunset",
  "Ocean waves crashing on a rocky coastline, golden hour",
  "Time-lapse of clouds moving over a mountain range",
  "A cat walking through a field of flowers in slow motion",
];

export default function FreeVideoStudio({ wavespeedKey = '' }) {
  const [selectedModelId, setSelectedModelId] = useState(freeVideoModels[0].id);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [currentVideo, setCurrentVideo] = useState(null); // { url, prompt, model }
  const [history, setHistory] = useState([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const textareaRef = useRef(null);
  const videoRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  const selectedModel = getFreeVideoModelById(selectedModelId) || freeVideoModels[0];

  // Load persisted state
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(PERSIST_KEY) || "{}");
      if (s.prompt) setPrompt(s.prompt);
      if (s.selectedModelId) setSelectedModelId(s.selectedModelId);
      // Only restore data-URL history entries
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const clean = h.filter((item) => item.url?.startsWith("data:"));
      setHistory(clean);
      if (clean.length !== h.length) localStorage.setItem(HISTORY_KEY, JSON.stringify(clean));
    } catch {}
    return () => { if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current); };
  }, []);

  // Save state
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(PERSIST_KEY, JSON.stringify({ prompt, selectedModelId }));
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [prompt, selectedModelId]);

  /**
   * Ken Burns effect: single image, smooth zoom+pan recorded as WebM.
   * Much faster (1 Pollinations call) and no rate-limit issues.
   */
  const renderKenBurns = useCallback((imageDataUrl) => {
    return new Promise((resolve, reject) => {
      const W = 768, H = 432;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");

      // Try VP9 first, fall back to VP8
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm;codecs=vp8";

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const reader = new FileReader();
        reader.onload = () => resolve({ url: reader.result, contentType: "video/webm" });
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      };

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const durationMs = 6000;   // 6 second video
        const fps = 30;
        const totalFrames = (durationMs / 1000) * fps;
        // Zoom from 1.0 → 1.12, pan slightly right+down
        const startScale = 1.0, endScale = 1.12;
        const startX = 0, endX = W * 0.06;
        const startY = 0, endY = H * 0.04;

        recorder.start();
        let f = 0;
        const drawFrame = () => {
          if (f >= totalFrames) { recorder.stop(); return; }
          const t = f / totalFrames;  // 0 → 1
          const scale = startScale + (endScale - startScale) * t;
          const ox = startX + (endX - startX) * t;
          const oy = startY + (endY - startY) * t;
          const sw = W / scale, sh = H / scale;
          ctx.drawImage(img, ox, oy, sw, sh, 0, 0, W, H);
          f++;
          requestAnimationFrame(drawFrame);
        };
        drawFrame();
      };
      img.onerror = reject;
      img.src = imageDataUrl;
    });
  }, []);

  /**
   * Generation pipeline:
   *  1. WaveSpeed Wan 2.1 (real video, if key set)
   *  2. SVD HF Space (free, quota-limited)
   *  3. Ken Burns animation fallback (always works)
   */
  const doGenerate = useCallback(async (setMsg) => {
    const hasWaveSpeed = wavespeedKey?.trim();

    if (hasWaveSpeed) {
      setMsg("🌊 Step 1/1 — Generating real AI video with Wan 2.1…");
    } else {
      setMsg("Step 1/2 — Generating image with XBOT…");
    }

    // Try server-side pipeline (WaveSpeed → SVD)
    try {
      const body = {
        prompt: prompt.trim(),
        wavespeedKey: wavespeedKey?.trim() || '',
        seed: Math.floor(Math.random() * 99999),
        motionBucket: 127,
        fps: 6,
      };
      const r = await fetch("/api/video-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) {
        return { ...d, mode: d.tier === 'wavespeed' ? 'wavespeed' : 'svd' };
      }
      const isQuota = d.isQuotaError || d.error?.includes("GPU quota") || d.error?.includes("exceeded") || d.error?.includes("quota");
      if (!isQuota) throw new Error(d.error || `Video proxy error: ${r.status}`);
      setMsg("⚡ GPU quota reached — switching to Ken Burns Animation…");
      await new Promise((res) => setTimeout(res, 1200));
    } catch (e) {
      const isQuota = e.message?.includes("GPU quota") || e.message?.includes("exceeded") || e.message?.includes("quota");
      if (!isQuota) throw e;
    }

    // Ken Burns fallback
    setMsg("🎨 Generating image with XBOT…");
    const imgResp = await fetch("/api/pollinations-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.trim(), width: 768, height: 432 }),
    });
    if (!imgResp.ok) {
      const e = await imgResp.json().catch(() => ({}));
      throw new Error(e.error || `Image generation failed: ${imgResp.status}`);
    }
    const imgData = await imgResp.json();
    const imageDataUrl = imgData.url || imgData.imageUrl || imgData.data;
    if (!imageDataUrl) throw new Error("No image returned from XBOT");
    setMsg("🎬 Rendering Ken Burns animation…");
    const result = await renderKenBurns(imageDataUrl);
    return { ...result, mode: "animation" };
  }, [prompt, wavespeedKey, renderKenBurns]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return;

    setGenerating(true);
    setError(null);
    setCurrentVideo(null);
    setIsPlaying(false);

    try {
      const data = await doGenerate(setLoadingMsg);

      const modelLabel =
        data.mode === 'wavespeed' ? 'Wan 2.1 (WaveSpeed)' :
        data.mode === 'animation' ? 'Ken Burns Animation' : 'SVD';
      const providerLabel =
        data.mode === 'wavespeed' ? 'wavespeed' :
        data.mode === 'animation' ? 'pollinations' : 'hf-space';
      const entry = {
        id: Date.now(),
        url: data.url,
        prompt: prompt.trim(),
        model: modelLabel,
        provider: providerLabel,
        timestamp: Date.now(),
      };

      setCurrentVideo(entry);
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, 10);
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
      setLoadingMsg("");
    }
  }, [prompt, generating, doGenerate]);

  const handleVideoToggle = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = (url, p) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-${Date.now()}.mp4`;
    a.click();
  };

  const useTip = (tip) => {
    setPrompt(tip);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  };

  // Elapsed time display during generation
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!generating) { setElapsed(0); return; }
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [generating]);

  return (
    <div className="h-full flex flex-col bg-[#030303] text-white overflow-hidden">
      {/* Top Bar */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-white/[0.04] flex items-center justify-between bg-black/30">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-xs font-black text-white/50 uppercase tracking-widest">Free Video Studio</span>
        </div>
        <span className="text-xs font-bold text-purple-400 bg-purple-400/10 border border-purple-400/20 px-3 py-1 rounded-full">
          {wavespeedKey?.trim()
            ? '🌊 Wan 2.1 (WaveSpeed) · Real AI Video'
            : '🎨 XBOT → 🎥 SVD · 100% Free'}
        </span>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Main Canvas */}
        <div className="flex-1 flex flex-col items-center justify-center relative p-6 min-w-0">
          {/* Generating state */}
          {generating && (
            <div className="flex flex-col items-center gap-6 text-center">
              {/* Animated video icon */}
              <div className="relative w-40 h-28 rounded-2xl border border-purple-400/20 bg-purple-400/5 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400/10 to-transparent animate-shimmer" style={{ backgroundSize: "200% 100%", animation: "shimmer 2s infinite linear" }} />
                {/* Film strip lines */}
                <div className="absolute left-0 top-0 bottom-0 w-6 flex flex-col justify-around py-2">
                  {[...Array(5)].map((_, i) => <div key={i} className="w-4 h-3 mx-auto rounded-sm bg-white/5 border border-white/10" />)}
                </div>
                <div className="absolute right-0 top-0 bottom-0 w-6 flex flex-col justify-around py-2">
                  {[...Array(5)].map((_, i) => <div key={i} className="w-4 h-3 mx-auto rounded-sm bg-white/5 border border-white/10" />)}
                </div>
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-white/10 border-t-purple-400 rounded-full animate-spin" />
                  <span className="text-xs font-bold text-purple-400">{elapsed}s</span>
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-white/80">
                  {loadingMsg || `Generating video…`}
                </p>
                <p className="text-xs text-white/30 mt-1">
                  Step 1: Generating image… Step 2: Animating with SVD. Takes 1-4 min.
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-400 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min((elapsed / 180) * 100, 95)}%` }}
                />
              </div>
            </div>
          )}

          {/* Video player */}
          {currentVideo && !generating && (
            <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
              <div className="relative group w-full rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl">
                <video
                  ref={videoRef}
                  src={currentVideo.url}
                  loop
                  playsInline
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100 || 0);
                    }
                  }}
                  className="w-full max-h-[50vh] object-contain"
                />

                {/* Video controls overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={handleVideoToggle}
                    className="w-14 h-14 bg-black/70 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all"
                  >
                    {isPlaying ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                        <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                  <div className="h-full bg-purple-400 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleVideoToggle}
                  className="flex items-center gap-2 px-5 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs font-bold text-purple-300 hover:bg-purple-500/30 transition-all"
                >
                  {isPlaying ? "⏸ Pause" : "▶ Play"}
                </button>
                <button
                  onClick={() => handleDownload(currentVideo.url, currentVideo.prompt)}
                  className="flex items-center gap-2 px-5 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-white/70 hover:bg-white/10 transition-all"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Download MP4
                </button>
                <span className="text-[10px] text-white/20">{selectedModel.resolution} · {selectedModel.maxDuration}s</span>
              </div>

              <p className="text-xs text-white/30 text-center max-w-md">"{currentVideo.prompt}"</p>
            </div>
          )}

          {/* Empty state */}
          {!currentVideo && !generating && (
            <div className="flex flex-col items-center gap-8 text-center max-w-lg">
              {/* Animated placeholder */}
              <div className="relative w-48 h-32 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-6 flex flex-col justify-around py-2 opacity-20">
                  {[...Array(5)].map((_, i) => <div key={i} className="w-4 h-3 mx-auto rounded-sm bg-white border border-white/20" />)}
                </div>
                <div className="absolute right-0 top-0 bottom-0 w-6 flex flex-col justify-around py-2 opacity-20">
                  {[...Array(5)].map((_, i) => <div key={i} className="w-4 h-3 mx-auto rounded-sm bg-white border border-white/20" />)}
                </div>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-white/20">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-2">Video will appear here</p>
                <p className="text-xs text-white/20">Text → Image (XBOT) → Video (SVD) · Completely free</p>
              </div>

              {/* Prompt tips */}
              <div className="w-full">
                <p className="text-[10px] text-white/20 uppercase tracking-widest mb-3 font-black">Try these prompts</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {TIPS.map((tip, i) => (
                    <button
                      key={i}
                      onClick={() => useTip(tip)}
                      className="text-[10px] text-white/40 border border-white/[0.06] px-3 py-1.5 rounded-full hover:border-purple-400/30 hover:text-purple-300 transition-all text-left"
                    >
                      {tip.length > 40 ? tip.slice(0, 40) + "…" : tip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="absolute bottom-6 left-6 right-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
              <span className="font-bold">Error: </span>{error}
              <button onClick={() => setError(null)} className="ml-2 text-red-400/50 hover:text-red-400 text-xs underline">dismiss</button>
            </div>
          )}
        </div>

        {/* History Sidebar */}
        {history.length > 0 && (
          <div className="w-[180px] shrink-0 border-l border-white/[0.04] flex flex-col bg-black/20">
            <div className="p-3 border-b border-white/[0.04] flex items-center justify-between">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">History</span>
              <button
                onClick={() => { setHistory([]); localStorage.removeItem(HISTORY_KEY); }}
                className="text-[9px] text-white/20 hover:text-white/50 transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => { setCurrentVideo(item); setIsPlaying(false); }}
                  className={`relative group rounded-xl overflow-hidden cursor-pointer border transition-all ${
                    currentVideo?.id === item.id ? "border-purple-400/40" : "border-white/5 hover:border-purple-400/20"
                  }`}
                >
                  {/* Video thumbnail (shows first frame) */}
                  <video
                    src={item.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full aspect-video object-cover bg-black"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    </div>
                  </div>
                  <div className="p-1.5 bg-black/60">
                    <p className="text-[8px] text-white/50 line-clamp-1">{item.prompt}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex-shrink-0 border-t border-white/[0.04] bg-black/40 backdrop-blur-md p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Prompt row */}
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
              }}
              placeholder="Describe your video… (Enter to generate)"
              rows={1}
              disabled={generating}
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-purple-400/40 transition-colors min-h-[44px] max-h-[120px] overflow-y-auto disabled:opacity-50"
            />
            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="h-10 px-6 bg-purple-500 text-white text-xs font-black rounded-full hover:bg-purple-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0 flex items-center gap-2"
            >
              {generating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
              {generating ? `${elapsed}s…` : "Generate"}
            </button>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Model picker */}
            <div className="relative">
              <button
                onClick={() => setShowModelPicker((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all"
              >
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded border text-purple-400 bg-purple-400/10 border-purple-400/20">
                  {selectedModel.badge}
                </span>
                <span className="text-white/80">{selectedModel.name}</span>
                <span className="text-white/30 text-[9px]">{selectedModel.resolution}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {showModelPicker && (
                <div className="absolute bottom-full left-0 mb-2 w-96 bg-[#111] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-white/5">
                    <p className="text-[10px] text-white/30 font-black uppercase tracking-wider">Select Video Model</p>
                  </div>
                  <div className="p-2">
                    {freeVideoModels.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => { setSelectedModelId(m.id); setShowModelPicker(false); }}
                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-all ${selectedModelId === m.id ? "bg-white/5" : ""}`}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded border text-purple-400 bg-purple-400/10 border-purple-400/20">{m.badge}</span>
                            <span className="text-xs font-bold text-white">{m.name}</span>
                            <span className="text-[9px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{m.resolution}</span>
                          </div>
                          <span className="text-[10px] text-white/30">{m.description}</span>
                        </div>
                        {selectedModelId === m.id && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pipeline status */}
            {wavespeedKey?.trim() ? (
              <span className="text-[10px] text-[#d9ff00]/70 border border-[#d9ff00]/20 bg-[#d9ff00]/5 px-2 py-1 rounded-lg">
                ✓ Wan 2.1 real video · WaveSpeed active
              </span>
            ) : (
              <span className="text-[10px] text-green-400/70 border border-green-400/20 bg-green-400/5 px-2 py-1 rounded-lg">
                ✓ Free · Add WaveSpeed key in Settings for real video
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
