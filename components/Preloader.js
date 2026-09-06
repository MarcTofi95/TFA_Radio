'use client';

import { useEffect, useRef, useState } from 'react';

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

// A single step-to-step transition actually mounts a *fresh* Preloader
// instance twice in quick succession: once immediately on the outgoing page
// (see each step's `navigating` state) and again when the incoming page
// mounts with its own loading state. Each mount used to replay the gold
// swipe-in from scratch, so a client saw two flashes back to back for what
// is really one transition. This module-level timestamp is shared across
// those mounts (client-side navigation keeps the module alive) so only the
// first mount within a transition actually plays the swipe — the second
// just continues showing the plain preloader underneath, with no visible
// re-flash.
let lastWipeAt = 0;
const WIPE_COOLDOWN_MS = 3000;

export default function Preloader({ fullScreen = true }) {
  const videoRef = useRef(null);
  const [showWipe] = useState(() => {
    const now = Date.now();
    if (now - lastWipeAt > WIPE_COOLDOWN_MS) {
      lastWipeAt = now;
      return true;
    }
    return false;
  });

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
      {/* One-shot swipe reveal, played at most once per transition (see
          showWipe above): a brand-gold panel slides in from the left, fully
          covers the preloader for a beat, then continues off to the right. */}
      {showWipe && <span className="tfa-preloader-wipe" aria-hidden="true" />}

      <video
        ref={videoRef}
        src="/brand/preloader.mp4"
        autoPlay
        loop
        muted
        playsInline
        onLoadedMetadata={(e) => { e.currentTarget.playbackRate = 2; }}
        style={{ width: 140, height: 140, objectFit: 'contain', position: 'relative', zIndex: 1 }}
      />

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
      `}</style>
    </div>
  );
}
