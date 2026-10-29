// frontend/src/app/page.tsx
"use client";

import React, { useState } from "react";
import {
  MERCHANT_CATALOG,
  CatalogSku,
  TelemetryMetrics,
  useAuraFitSession,
} from "../lib/client";

const CLINICAL_PRESETS: ReadonlyArray<{ label: string; prompt: string }> = [
  {
    label: "1. Acute Vasomotor Flush (520nm Sage Linen)",
    prompt:
      "Experiencing an acute hot flash and facial flushing ahead of an executive board presentation. Synthesize SKU-SAGE-LINEN-01.",
  },
  {
    label: "2. Post-Partum Humidity Spike (480nm Slate Silk)",
    prompt:
      "Experiencing post-partum hormonal skin redness in 80% humidity. Synthesize cooling SKU-SLATE-SILK-02 silk blouse.",
  },
];

function TelemetryHeader({
  telemetry,
  sessionId,
}: {
  telemetry: TelemetryMetrics;
  sessionId: string | null;
}) {
  return (
    <header className="sticky top-0 z-30 bg-slate-950 text-slate-100 border-b border-slate-800 px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center space-x-3">
          <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-700 rounded">
            AURAFIT B2B2C SDK v2.0
          </span>
          <span className="text-slate-400">
            CLAIM-CHECK UUID: {sessionId ? sessionId.slice(0, 8) : "UNBOUND"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div>
            <span className="text-slate-400 block">VON KRIES ERYTHEMA</span>
            <span className="text-sm font-semibold text-white">
              {telemetry.normalized_erythema.toFixed(1)} / 100
            </span>
          </div>

          <div>
            <span className="text-slate-400 block">VASOMOTOR INDEX</span>
            <span
              className={`text-sm font-semibold ${
                telemetry.vasomotor_flare_detected
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {telemetry.vasomotor_index.toFixed(1)}{" "}
              {telemetry.vasomotor_flare_detected ? "[FLARE ACTIVE]" : "[BASELINE]"}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block">WAVELENGTH GATE</span>
            <span className="text-sm font-semibold text-cyan-400">
              {telemetry.recommended_wavelength_nm}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block">VTO CACHE STATUS</span>
            <span
              className={`text-sm font-semibold ${
                telemetry.cache_hit ? "text-emerald-400" : "text-slate-200"
              }`}
            >
              {telemetry.latency_ms === 0
                ? "--"
                : telemetry.cache_hit
                ? "SHA-256 HIT (0ms)"
                : `MISS (${telemetry.latency_ms}ms)`}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block">SESSION API COGS</span>
            <span className="text-sm font-semibold text-emerald-400">
              ${telemetry.estimated_cogs_usd.toFixed(3)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

function SkuCard({
  sku,
  isAllowed,
  isActive,
  flareActive,
  onSelectSku,
}: {
  sku: CatalogSku;
  isAllowed: boolean;
  isActive: boolean;
  flareActive: boolean;
  onSelectSku: (skuId: string) => void;
}) {
  return (
    <div
      onClick={() => isAllowed && onSelectSku(sku.id)}
      className={`p-5 rounded-lg border transition-all ${
        !isAllowed
          ? "bg-slate-100 border-slate-300 opacity-60 cursor-not-allowed"
          : isActive
          ? "bg-white border-emerald-600 ring-2 ring-emerald-600 shadow-sm cursor-pointer"
          : "bg-white border-slate-200 hover:border-slate-400 cursor-pointer"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
            {sku.id}
          </span>
          <h3 className="text-base font-semibold text-slate-900 mt-0.5">
            {sku.name}
          </h3>
        </div>
        <span className="text-base font-bold text-slate-900">${sku.priceUsd}</span>
      </div>

      <div className="mt-3 space-y-1 text-xs text-slate-600">
        <p>
          <strong className="text-slate-800">Spectral Profile:</strong>{" "}
          {sku.wavelengthNm}
        </p>
        <p>
          <strong className="text-slate-800">Material Spec:</strong> {sku.fabricSpec}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
        <span className="text-slate-600">
          Est. Return Delta: -{sku.returnReductionPct}%
        </span>
        {!isAllowed ? (
          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-semibold">
            BLOCKED: ERYTHEMA CONFLICT
          </span>
        ) : isActive && flareActive ? (
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold">
            ACTIVE VTO RENDER
          </span>
        ) : (
          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
            CLICK TO SYNTHESIZE VTO
          </span>
        )}
      </div>
    </div>
  );
}

export default function AuraFitStorefrontStudio() {
  const {
    sourceImageB64,
    vtoImageB64,
    agentReasoning,
    sessionId,
    telemetry,
    isProcessing,
    errorBanner,
    ingestImageFile,
    loadSyntheticSubject,
    triggerConsultation,
  } = useAuraFitSession();

  const [promptInput, setPromptInput] = useState<string>(
    CLINICAL_PRESETS[0].prompt
  );
  const [curtainSplitPct, setCurtainSplitPct] = useState<number>(50);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      void ingestImageFile(selected);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void triggerConsultation(promptInput);
  };

  const handleSkuClick = (skuId: string) => {
    const nextPrompt = `Evaluate vasomotor state and synthesize ${skuId} onto current scan.`;
    setPromptInput(nextPrompt);
    void triggerConsultation(nextPrompt);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TelemetryHeader telemetry={telemetry} sessionId={sessionId} />

      <main className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 p-6">
        {/* Left Column (5 Cols): Host D2C Merchant Storefront Catalog */}
        <section className="lg:col-span-5 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500">
              HOST MERCHANT STOREFRONT // SHOPIFY PLUS SDK DEMO
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              AETHERIA THERMOREGULATING ATELIER
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Catalog dynamically gated by YouCam Skin AI erythema diagnostics.
              Click any eligible SKU to verify SHA-256 VTO caching.
            </p>
          </div>

          <div className="space-y-4">
            {MERCHANT_CATALOG.map((sku) => (
              <SkuCard
                key={sku.id}
                sku={sku}
                isAllowed={telemetry.allowed_skus.includes(sku.id)}
                isActive={telemetry.active_sku === sku.id && Boolean(vtoImageB64)}
                flareActive={telemetry.vasomotor_flare_detected}
                onSelectSku={handleSkuClick}
              />
            ))}
          </div>
        </section>

        {/* Right Column (7 Cols): Embedded AuraFit Physiological VTO Drawer */}
        <section className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Adaptive Fit & Undertone Diagnostic Drawer
                </h2>
                <p className="text-xs text-slate-500">
                  Out-of-Band Claim-Check Architecture | Gray-World Chromatic Normalization
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-bold px-4 py-2.5 rounded-lg shadow-sm transition inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>{sourceImageB64 ? "REPLACE SCAN" : "UPLOAD SCAN"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="user"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={loadSyntheticSubject}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-mono px-3.5 py-2.5 rounded-lg transition"
                >
                  LOAD SYNTHETIC SUBJECT
                </button>
              </div>
            </div>

            {errorBanner && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-mono">
                ERROR: {errorBanner}
              </div>
            )}

            {/* Side-by-Side + Interactive Split-Curtain Inspection Viewport */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <div className="border border-slate-200 rounded-lg bg-slate-100 aspect-[4/5] flex flex-col items-center justify-center overflow-hidden relative">
                {sourceImageB64 ? (
                  <>
                    <img
                      src={sourceImageB64}
                      alt="Baseline Facial Scan"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-2 left-2 bg-slate-950/85 text-white text-[10px] font-mono px-2 py-1 rounded">
                      STEP 1: 2700K INGRESS BASELINE
                    </span>
                  </>
                ) : (
                  <div className="text-center p-6 flex flex-col items-center justify-center h-full">
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-xs font-mono font-bold uppercase text-slate-700">
                      Step 1: Facial Baseline
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      Upload an image or use the synthetic subject to begin analysis.
                    </p>
                    <label className="mt-4 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-bold px-4 py-2 rounded-lg shadow-sm transition">
                      UPLOAD SCAN PHOTO
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="user"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="border border-slate-200 rounded-lg bg-slate-100 aspect-[4/5] flex flex-col items-center justify-center overflow-hidden relative">
                {isProcessing ? (
                  <div className="text-center p-6 space-y-2">
                    <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-mono text-slate-700">
                      EXECUTING YOUCAM SKIN AI + VTO...
                    </p>
                  </div>
                ) : vtoImageB64 && sourceImageB64 ? (
                  <div className="relative w-full h-full select-none">
                    <img
                      src={vtoImageB64}
                      alt="Synthesized Apparel VTO"
                      className="w-full h-full object-cover"
                    />
                    <div
                      className="absolute inset-y-0 left-0 overflow-hidden"
                      style={{ width: `${curtainSplitPct}%` }}
                    >
                      <img
                        src={sourceImageB64}
                        alt="Before Overlay"
                        className="h-full max-w-none object-cover"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div
                      className="absolute inset-y-0 w-0.5 bg-emerald-400 shadow"
                      style={{ left: `${curtainSplitPct}%` }}
                    />
                    <input
                      type="range"
                      min={5}
                      max={95}
                      value={curtainSplitPct}
                      onChange={(e) => setCurtainSplitPct(Number(e.target.value))}
                      className="absolute bottom-8 left-4 right-4 z-20 accent-emerald-500 cursor-ew-resize"
                    />
                    <span className="absolute bottom-2 left-2 bg-emerald-950/90 text-emerald-300 text-[10px] font-mono px-2 py-1 rounded">
                      STEP 2: {telemetry.active_sku} VTO (DRAG SLIDER)
                    </span>
                  </div>
                ) : (
                  <div className="text-center p-6">
                    <p className="text-xs font-mono uppercase text-slate-500">
                      Step 2: Generative Apparel VTO
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Von Kries balanced + spectral garment drape renders here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Agentic Clinical Rationale Output */}
          {agentReasoning && (
            <div className="p-4 bg-slate-900 text-slate-100 rounded-lg border border-slate-800 space-y-1.5">
              <div className="text-[11px] font-mono text-emerald-400 uppercase">
                Orchestrator Diagnostic & Spectral Styling Rationale
              </div>
              <p className="text-xs leading-relaxed text-slate-200 font-mono">
                {agentReasoning}
              </p>
            </div>
          )}

          {/* Situational Context Controls & Preset Triggers */}
          <form onSubmit={handleFormSubmit} className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-slate-500">
                JUDGE PRESETS:
              </span>
              {CLINICAL_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setPromptInput(preset.prompt)}
                  className="text-[11px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 rounded border border-slate-300 transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Describe physiological state and environment..."
                className="flex-1 text-xs border border-slate-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <button
                type="submit"
                disabled={isProcessing || !sourceImageB64}
                className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-300 text-white text-xs font-mono font-semibold px-5 py-2.5 rounded-lg transition"
              >
                {isProcessing ? "SYNTHESIZING..." : "RUN DIAGNOSTIC & VTO"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}