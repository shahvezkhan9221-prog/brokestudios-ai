"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { generateImageFree, uploadFileFree } from "../freeapi.js";
import { freeT2IModels, AR_TO_DIMS, getAspectRatiosForFreeModel } from "../freeModels.js";

const PERSIST_KEY = "free_image_studio";
const HISTORY_KEY = "free_image_history";

const PROVIDER_COLORS = {
  pollinations: "text-green-400 bg-green-400/10 border-green-400/20",
  huggingface: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  horde: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

export default function FreeImageStudio({ hfToken = "" }) {
  const [selectedModelId, setSelectedModelId] = useState(freeT2IModels[0].id);
  const [selectedAr, setSelectedAr] = useState("1:1");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(null);
  const [history, setHistory] = useState([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [enhance, setEnhance] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const selectedModel = freeT2IModels.find((m) => m.id === selectedModelId) || freeT2IModels[0];
  const arOptions = getAspectRatiosForFreeModel(selectedModelId);

  // Load persisted state — purge old direct URLs (only keep data: URLs)
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(PERSIST_KEY) || "{}");
      if (s.prompt) setPrompt(s.prompt);
      if (s.selectedModelId) setSelectedModelId(s.selectedModelId);
      if (s.selectedAr) setSelectedAr(s.selectedAr);
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      // Only keep entries with permanent data URLs — purge old Pollinations direct URLs
      const clean = h.filter((item) => item.url?.startsWith('data:'));
      if (clean.length !== h.length) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(clean));
      }
      setHistory(clean);
    } catch {}
  }, []);

  // Save state
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(PERSIST_KEY, JSON.stringify({ prompt, selectedModelId, selectedAr }));
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [prompt, selectedModelId, selectedAr]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);
    setCurrentUrl(null);

    const dims = AR_TO_DIMS[selectedAr] || { width: 1024, height: 1024 };

    try {
      const result = await generateImageFree({
        provider: selectedModel.provider,
        model: selectedModel.pollinationsModel || selectedModel.hfModel || selectedModel.hordeModel,
        prompt: prompt.trim(),
        width: dims.width,
        height: dims.height,
        hfToken,
        enhance,
      });

      if (!result?.url) throw new Error("No image URL returned");

      const entry = {
        id: Date.now(),
        url: result.url,
        prompt: prompt.trim(),
        model: selectedModel.name,
        provider: selectedModel.provider,
        ar: selectedAr,
        timestamp: Date.now(),
      };

      setCurrentUrl(result.url);
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, 50);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }, [prompt, selectedModel, selectedAr, generating, hfToken, enhance]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await uploadFileFree(file);
      setUploadedImageUrl(dataUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (url) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `generated-${Date.now()}.png`;
    a.target = "_blank";
    a.click();
  };

  const filteredModels = freeT2IModels.filter(
    (m) =>
      m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.provider.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const isLoading = generating;

  return (
    <div className="h-full flex flex-col bg-[#030303] text-white overflow-hidden">
      {/* Top Bar */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-white/[0.04] flex items-center justify-between bg-black/30">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-black text-white/50 uppercase tracking-widest">Free Image Studio</span>
        </div>
        <span className="text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-3 py-1 rounded-full">
          ∞ Unlimited · No Key Needed
        </span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Canvas */}
        <div className="flex-1 flex flex-col items-center justify-center relative p-6 min-w-0">
          {/* Spinner — shown while generating OR while image is loading from URL */}
          {isLoading && (
            <div className="flex flex-col items-center gap-6">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 rounded-full border-2 border-white/5 border-t-[#d9ff00] animate-spin" />
                <div
                  className="absolute inset-4 rounded-full border-2 border-white/5 border-b-green-400 animate-spin"
                  style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-white/80">
                  {generating ? `Generating with ${selectedModel.name}` : "Loading image…"}
                </p>
                <p className="text-xs text-white/30 mt-1">
                  {selectedModel.provider === "pollinations"
                    ? "XBOT generates in 5-20 seconds…"
                    : selectedModel.provider === "huggingface"
                    ? "Usually 10-30 seconds…"
                    : "AI Horde queue — may take 1-5 min…"}
                </p>
              </div>
            </div>
          )}

          {/* Image — hidden while loading, shown on load */}
          {currentUrl && (
            <div
              className="relative group max-h-full max-w-full"
              style={{ display: isLoading ? "none" : "block" }}
            >
              <img
                key={currentUrl}
                src={currentUrl}
                alt={prompt}
                className="max-h-[65vh] max-w-full rounded-2xl shadow-2xl object-contain border border-white/10"
              />
              <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDownload(currentUrl)}
                  className="p-2 bg-black/70 backdrop-blur-md rounded-full border border-white/10 hover:bg-[#d9ff00] hover:text-black transition-all"
                  title="Download"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!currentUrl && !isLoading && (
            <div className="flex flex-col items-center gap-4 text-center opacity-30">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.75">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <p className="text-sm font-bold uppercase tracking-widest">Your image will appear here</p>
              <p className="text-xs">100% free · Powered by XBOT</p>
            </div>
          )}

          {error && (
            <div className="absolute bottom-6 left-6 right-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
              <span className="font-bold">Error: </span>{error}
              <button
                onClick={() => setError(null)}
                className="ml-2 text-red-400/50 hover:text-red-400 text-xs underline"
              >
                dismiss
              </button>
            </div>
          )}
        </div>

        {/* Right: History Sidebar */}
        {history.length > 0 && (
          <div className="w-[200px] shrink-0 border-l border-white/[0.04] flex flex-col bg-black/20">
            <div className="p-3 border-b border-white/[0.04]">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">History</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
              {history.map((item) => (
                <HistoryThumb key={item.id} item={item} onSelect={() => { setCurrentUrl(item.url); setImgLoading(item.provider === "pollinations"); }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Prompt Bar */}
      <div className="flex-shrink-0 border-t border-white/[0.04] bg-black/40 backdrop-blur-md p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex gap-3 items-end">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Upload reference image"
              className={`w-10 h-10 shrink-0 rounded-full border flex items-center justify-center transition-all ${
                uploadedImageUrl ? "border-[#d9ff00]/60 bg-[#d9ff00]/10" : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              {uploading ? (
                <div className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin" />
              ) : uploadedImageUrl ? (
                <img src={uploadedImageUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                </svg>
              )}
            </button>

            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
              }}
              placeholder="Describe your image… (Enter to generate)"
              rows={1}
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-[#d9ff00]/40 transition-colors min-h-[44px] max-h-[160px] overflow-y-auto"
            />

            <button
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className="h-10 px-6 bg-[#d9ff00] text-black text-xs font-black rounded-full hover:bg-[#ebff66] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0 flex items-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
              {isLoading ? "…" : "Generate"}
            </button>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Model picker */}
            <div className="relative">
              <button
                onClick={() => setShowModelPicker((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all"
              >
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${PROVIDER_COLORS[selectedModel.provider]}`}>
                  {selectedModel.badge}
                </span>
                <span className="text-white/80">{selectedModel.name}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
              </button>

              {showModelPicker && (
                <div className="absolute bottom-full left-0 mb-2 w-80 bg-[#111] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-white/5">
                    <input
                      type="text"
                      placeholder="Search models…"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto p-2">
                    {filteredModels.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => { setSelectedModelId(m.id); setSelectedAr(m.inputs.aspect_ratio.default); setShowModelPicker(false); setModelSearch(""); }}
                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-all ${selectedModelId === m.id ? "bg-white/5" : ""}`}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${PROVIDER_COLORS[m.provider]}`}>{m.badge}</span>
                            <span className="text-xs font-bold text-white">{m.name}</span>
                          </div>
                          <span className="text-[10px] text-white/30">{m.description}</span>
                        </div>
                        {selectedModelId === m.id && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Aspect ratio */}
            <select
              value={selectedAr}
              onChange={(e) => setSelectedAr(e.target.value)}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white/80 focus:outline-none cursor-pointer transition-all"
            >
              {arOptions.map((ar) => (
                <option key={ar} value={ar} className="bg-[#111]">{ar}</option>
              ))}
            </select>

            {/* Enhance */}
            {selectedModel.provider === "pollinations" && (
              <button
                onClick={() => setEnhance((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-bold transition-all ${
                  enhance ? "bg-[#d9ff00]/10 border-[#d9ff00]/30 text-[#d9ff00]" : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
                }`}
              >
                ✨ Enhance
              </button>
            )}

            {selectedModel.requiresHFToken && !hfToken && (
              <span className="text-[10px] text-yellow-400/70 border border-yellow-400/20 bg-yellow-400/5 px-2 py-1 rounded-lg">
                ⚠ Set HF Token in Settings
              </span>
            )}

            {history.length > 0 && (
              <button
                onClick={() => { setHistory([]); localStorage.removeItem(HISTORY_KEY); }}
                className="ml-auto text-[10px] text-white/20 hover:text-white/50 transition-colors"
              >
                Clear history
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── History thumbnail ───────────────────────────────────────────────────────

function HistoryThumb({ item, onSelect }) {
  return (
    <div
      onClick={onSelect}
      className="relative group rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-[#d9ff00]/30 transition-all aspect-square bg-white/5"
    >
      <img
        src={item.url}
        alt={item.prompt}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
        <p className="text-[8px] text-white/80 line-clamp-2 leading-tight">{item.prompt}</p>
      </div>
    </div>
  );
}
