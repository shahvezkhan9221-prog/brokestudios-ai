'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Load studios
const FreeImageStudio = dynamic(
  () => import('studio/dist/components/FreeImageStudio'),
  { ssr: false, loading: () => <LoadingSpinner /> }
);
const FreeVideoStudio = dynamic(
  () => import('studio/dist/components/FreeVideoStudio'),
  { ssr: false, loading: () => <LoadingSpinner /> }
);

const TABS = [
  { id: 'image', label: 'Image Studio', icon: '🖼️' },
  { id: 'video', label: 'Video Studio', icon: '🎬' },
];

const HF_TOKEN_KEY = 'hf_token';
const WS_KEY = 'wavespeed_api_key';

function LoadingSpinner() {
  return (
    <div className="h-full flex items-center justify-center bg-[#030303]">
      <div className="w-10 h-10 border-2 border-white/5 border-t-[#d9ff00] rounded-full animate-spin" />
    </div>
  );
}

export default function FreeShell() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('image');
  const [hfToken, setHfToken] = useState('');
  const [wavespeedKey, setWavespeedKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [hfInput, setHfInput] = useState('');
  const [wsInput, setWsInput] = useState('');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    const storedHF = localStorage.getItem(HF_TOKEN_KEY) || '';
    const storedWS = localStorage.getItem(WS_KEY) || '';
    setHfToken(storedHF);
    setHfInput(storedHF);
    setWavespeedKey(storedWS);
    setWsInput(storedWS);
  }, []);

  const saveSettings = () => {
    localStorage.setItem(HF_TOKEN_KEY, hfInput);
    localStorage.setItem(WS_KEY, wsInput);
    setHfToken(hfInput);
    setWavespeedKey(wsInput);
    setShowSettings(false);
  };

  if (!hasMounted) return <LoadingSpinner />;

  return (
    <div className="h-screen bg-[#030303] flex flex-col overflow-hidden text-white">
      {/* Header */}
      <header className="flex-shrink-0 h-14 border-b border-white/[0.03] flex items-center justify-between px-6 bg-black/20 backdrop-blur-md z-40">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#d9ff00] rounded-lg flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span className="text-sm font-black tracking-tight">Broke<span className="text-[#d9ff00]">Studios</span> AI</span>
          <span className="text-[9px] font-black text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full uppercase tracking-wider ml-1">
            100% FREE
          </span>
        </div>

        {/* Tabs */}
        <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative py-4 text-[13px] font-medium transition-all whitespace-nowrap px-1 ${
                activeTab === tab.id ? 'text-[#d9ff00]' : 'text-white/50 hover:text-white'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#d9ff00] rounded-full" />
              )}
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 text-xs font-bold text-green-400">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            ∞ FREE
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-[13px] font-bold text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            Settings
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'image' && <FreeImageStudio hfToken={hfToken} />}
        {activeTab === 'video' && <FreeVideoStudio hfToken={hfToken} wavespeedKey={wavespeedKey} />}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-white font-black text-lg mb-1">Settings</h2>
            <p className="text-white/30 text-xs mb-6">
              All features work without any key. Add API keys to unlock real AI video generation.
            </p>

            {/* Free tier info */}
            <div className="bg-green-400/5 border border-green-400/20 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-black text-green-400 uppercase tracking-wider">XBOT — Active</span>
              </div>
              <p className="text-xs text-white/40">
                6 models available · No key needed · FLUX, Turbo, Anime, 3D, Realism &amp; GPT Image
              </p>
            </div>

            {/* WaveSpeed Key — primary for real video */}
            <div className="space-y-2 mb-5">
              <label className="block text-xs font-black text-white/40 uppercase tracking-wider">
                WaveSpeed API Key{' '}
                <span className="text-[#d9ff00]/70 font-normal normal-case">← Real AI video (Wan 2.1, recommended)</span>
              </label>
              <input
                type="password"
                value={wsInput}
                onChange={(e) => setWsInput(e.target.value)}
                placeholder="ws_••••••••••••••••••••••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#d9ff00]/30 transition-colors"
              />
              <p className="text-[10px] text-white/20">
                Free credits on signup (no CC) at{' '}
                <a href="https://wavespeed.ai" target="_blank" rel="noreferrer" className="text-[#d9ff00]/60 hover:text-[#d9ff00] underline">
                  wavespeed.ai
                </a>{' '}
                — sign in with Google → Dashboard → API Keys
              </p>
              {wsInput && (
                <div className="flex items-center gap-1.5 text-[10px] text-[#d9ff00]/70">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#d9ff00]" />
                  Wan 2.1 real AI video enabled
                </div>
              )}
            </div>

            {/* HF Token */}
            <div className="space-y-2 mb-6">
              <label className="block text-xs font-black text-white/40 uppercase tracking-wider">
                Hugging Face Token{' '}
                <span className="text-yellow-400/60 font-normal normal-case">(optional — SVD fallback)</span>
              </label>
              <input
                type="password"
                value={hfInput}
                onChange={(e) => setHfInput(e.target.value)}
                placeholder="hf_••••••••••••••••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#d9ff00]/30 transition-colors"
              />
              <p className="text-[10px] text-white/20">
                Get a free token at{' '}
                <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-[#d9ff00]/60 hover:text-[#d9ff00] underline">
                  huggingface.co/settings/tokens
                </a>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveSettings}
                className="flex-1 h-10 rounded-xl bg-[#d9ff00] text-black text-xs font-black hover:bg-[#ebff66] transition-all"
              >
                Save
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white/70 hover:bg-white/10 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
