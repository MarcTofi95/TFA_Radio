'use client';

import { useEffect, useRef } from 'react';

// Full-screen loading state built from the client's animated brand mark
// (public/brand/preloader.mp4) instead of a blank page or a generic spinner.
// Used everywhere the app previously rendered nothing (`return null`) while
// waiting on a brief to load, and as the root route-level loading.js fallback
// shown during slower server-rendered page transitions (e.g. the dashboard
// pages, which fetch real data server-side before rendering).
//
// Played back at 2x speed (a ~4s clip loops in ~2s) so the animation itself
// feels snappier — separate from useMinDelay(loading, ms), which controls
// how long the Preloader stays mounted/visible, not the video's own pace.
// The gold panel that swipes across on mount (see .tfa-preloader-wipe below)
// and the small equalizer-style bar cluster underneath the video — a nod to
// the brand's radio/audio identity — are purely decorative CSS, not driven
// by any real audio: nothing is actually playing while the preloader shows,
// so this fakes an audio-wavelength feel rather than reading real levels.
const WAVE_BAR_COUNT = 7;

export default function Preloader({ fullScreen = true }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 2;
  }, []);

  return (
    <div
      className="tfa-preloader-root"
      style={{
        position: fullScreen ? 'fixed' : 'static',
        inset: fullScreen ? 0 : undefined,
        minHeight: fullScreen ? undefined : '40vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1D1D1D',
        zIndex: 999,
        overflow: 'hidden',
      }}
    >
      {/* One-shot swipe reveal: a brand-gold panel slides in from the left,
          fully covers the preloader for a beat, then continues off to the
          right — so the preloader itself arrives with a clean modern wipe
          instead of just popping into view. */}
      <span className="tfa-preloader-wipe" aria-hidden="true" />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
        <video
          ref={videoRef}
          src="/brand/preloader.mp4"
          autoPlay
          loop
          muted
          playsInline
          onLoadedMetadata={(e) => { e.currentTarget.playbackRate = 2; }}
          style={{ width: 140, height: 140, objectFit: 'contain' }}
        />
        <div className="tfa-preloader-wave" aria-hidden="true">
          {Array.from({ length: WAVE_BAR_COUNT }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.09}s` }} />
          ))}
        </div>
      </div>

      <style jsx>{`
        .tfa-preloader-wipe {
          position: absolute;
          inset: 0;
          background: #E6C858;
          z-index: 2;
          pointer-events: none;
          animation: tfa-preloader-wipe-move .68s cubic-bezier(.76, 0, .24, 1) both;
        }
        @keyframes tfa-preloader-wipe-move {
          0% { transform: translateX(-100%); }
          45% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        .tfa-preloader-wave {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 22px;
        }
        .tfa-preloader-wave span {
          display: block;
          width: 3px;
          border-radius: 2px;
          background: #E6C858;
          height: 6px;
          animation: tfa-preloader-wave-bar .9s ease-in-out infinite;
        }
        @keyframes tfa-preloader-wave-bar {
          0%, 100% { height: 6px; opacity: .5; }
          50% { height: 22px; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
