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
//
// No entrance/exit animation lives here on purpose: a step transition mounts
// a fresh Preloader instance twice in a row (once instantly when "next" is
// clicked, again when the next page mounts), so any flourish drawn inside
// this component would replay twice back to back. The one gold swipe
// transition in this flow lives in StepShell instead, since that mounts
// exactly once — right as the preloader hands off to the next page.
export default function Preloader({ fullScreen = true }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 2;
  }, []);

  return (
    <div
      style={{
        position: fullScreen ? 'fixed' : 'static',
        inset: fullScreen ? 0 : undefined,
        minHeight: fullScreen ? undefined : '40vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1D1D1D',
        zIndex: 999,
      }}
    >
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
    </div>
  );
}
