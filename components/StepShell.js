'use client';

import { useState } from 'react';
import Link from 'next/link';
import BrandMark from './BrandMark';
import { STEPS, computeReached } from './flowData';

function WaveIcon({ dim }) {
  const fill = dim ? '#514E44' : '#E6C858';
  const opacity = dim ? 0.5 : 1;
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" style={{ flex: 'none' }}>
      <rect x="0" y="3" width="1.6" height="4" rx="0.8" fill={fill} opacity={opacity} />
      <rect x="2.8" y="1.5" width="1.6" height="7" rx="0.8" fill={fill} opacity={opacity} />
      <rect x="5.6" y="0" width="1.6" height="10" rx="0.8" fill={fill} opacity={opacity} />
      <rect x="8.4" y="1.5" width="1.6" height="7" rx="0.8" fill={fill} opacity={opacity} />
      <rect x="11.2" y="3" width="1.6" height="4" rx="0.8" fill={fill} opacity={opacity} />
    </svg>
  );
}

// Reassures the client that leaving mid-form is safe (every field already
// autosaves as they type — see useBrief's schedulePatch) and gives them two
// ways back in: copy the current link, or have it emailed to them. Neither
// button changes what's saved — the brief is already persisted to the same
// row the whole time — they're purely a way to hold onto/retrieve the link.
function ResumeCard({ briefId, defaultEmail }) {
  const [open, setOpen] = useState(false);
  const [copyState, setCopyState] = useState('idle');
  const [email, setEmail] = useState(defaultEmail || '');
  const [emailState, setEmailState] = useState('idle');

  async function copyLink() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch (e) {
      setCopyState('error');
    }
    setTimeout(() => setCopyState('idle'), 2200);
  }

  async function sendLink() {
    const value = email.trim();
    if (!value || !briefId) return;
    setEmailState('sending');
    try {
      const res = await fetch(`/api/briefs/${briefId}/resume-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      setEmailState(res.ok ? 'sent' : 'error');
    } catch (e) {
      setEmailState('error');
    }
    setTimeout(() => setEmailState('idle'), 3000);
  }

  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid #33301F' }}>
      <div style={{ fontSize: 12, color: '#D8D5CB', lineHeight: 1.5 }}>
        Je voortgang wordt automatisch opgeslagen — je kunt altijd later verdergaan via deze link.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
        <button
          type="button"
          onClick={copyLink}
          style={{ flex: 1, border: '1px solid #514E44', background: 'transparent', color: '#FFFFFF', borderRadius: 7, padding: '7px 8px', fontSize: 11.5, cursor: 'pointer' }}
        >
          {copyState === 'copied' ? '✓ Gekopieerd' : copyState === 'error' ? 'Kon niet kopiëren' : 'Kopieer link'}
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{ flex: 1, border: '1px solid #514E44', background: 'transparent', color: '#FFFFFF', borderRadius: 7, padding: '7px 8px', fontSize: 11.5, cursor: 'pointer' }}
        >
          {open ? 'Sluiten' : 'E-mail mij de link'}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jouw@email.nl"
            style={{ flex: 1, minWidth: 0, border: '1px solid #514E44', background: '#26241A', color: '#FFFFFF', borderRadius: 7, padding: '7px 9px', fontSize: 12 }}
          />
          <button
            type="button"
            onClick={sendLink}
            disabled={emailState === 'sending' || !email.trim()}
            style={{
              flex: 'none', border: 'none', background: '#E6C858', color: '#1D1D1D', borderRadius: 7, padding: '7px 12px',
              fontSize: 11.5, fontWeight: 600, cursor: emailState === 'sending' ? 'wait' : 'pointer', opacity: emailState === 'sending' ? 0.7 : 1,
            }}
          >
            {emailState === 'sent' ? '✓ Verstuurd' : emailState === 'error' ? 'Mislukt' : emailState === 'sending' ? '…' : 'Verstuur'}
          </button>
        </div>
      )}
    </div>
  );
}

// The dark sidebar + big number + fixed-header content panel shared by every
// step of the client brief flow (contact/delivery/details/script/voice/
// music/overview) — ports the sidebar behavior from every original
// public/*.html page (applyReachableSteps) into one place.
//
// Fills the full viewport edge-to-edge, the same way /dashboard's shell does
// (no centered card, no outer gutters) — the sidebar and the white content
// panel both run the full height of the screen, and only the white content
// panel scrolls internally when a step's form is taller than the viewport,
// so the dark sidebar never looks shorter/taller than the content next to
// it and never scrolls out of view itself.
export default function StepShell({ briefId, current, brief, subtitle, bigNum, kicker, title, hint, backHref, backLabel, children }) {
  const reached = computeReached(brief);
  const companyName = brief && brief.companyName && brief.companyName.trim() ? brief.companyName : null;

  return (
    <div style={{ height: '100vh', background: '#DEDCD7', display: 'flex', overflow: 'hidden' }} className="tfa-shell">
      {/* The one gold swipe transition in the whole flow: StepShell mounts
          exactly once per step (unlike Preloader, which mounts twice per
          transition — see the comment in Preloader.js), so this is the
          right place for it. The page underneath is already fully rendered
          the instant this mounts; the panel just covers it for a beat and
          then slides off, so the swipe reads as "the preloader hands off
          into this page" rather than a flash tacked onto the preloader
          itself. */}
      <span className="tfa-shell-wipe" aria-hidden="true" />
      <div
        style={{
          flex: '0 0 300px', height: '100%', background: '#1D1D1D', color: '#FFFFFF', padding: '36px 26px',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}
        className="tfa-sidebar"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, letterSpacing: '.09em', textTransform: 'uppercase', color: '#E6C858', fontWeight: 500 }}>
          <BrandMark size={22} />
          TFA
        </div>
        {/* On step 1 the client hasn't had a chance to fill in the company
            name yet (it's the very field this step asks for), so showing a
            "Nog geen bedrijfsnaam" placeholder here reads as if something's
            missing before they've even started. It only starts appearing
            from step 2 onward, once the name has actually been saved. */}
        {current !== 1 && (
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600, fontSize: 24,
              color: companyName ? '#FFFFFF' : '#8C897E', margin: '16px 0 0', lineHeight: 1.3,
            }}
          >
            {companyName || 'Nog geen bedrijfsnaam'}
          </h1>
        )}
        {subtitle ? <div style={{ fontSize: 11.5, color: '#B9B6AC', marginTop: 4 }}>{subtitle}</div> : null}

        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {STEPS.map((step) => {
            const isCurrent = step.n === current;
            const isDone = !isCurrent && (step.n < current || !!reached[step.n]);
            // Background/border-left are only set inline for the CURRENT
            // step. For every other row they're left to the "tfa-step-item"
            // CSS class below instead of being inlined as 'transparent' —
            // an inline style always wins over a stylesheet :hover rule for
            // the same property, so inlining 'transparent' here was silently
            // cancelling out the hover highlight on every clickable step.
            const rowStyle = {
              display: 'flex', alignItems: 'center', gap: 10, padding: isCurrent ? '10px 12px' : '9px 10px',
              borderRadius: '0 6px 6px 0', textDecoration: 'none', cursor: isDone ? 'pointer' : 'default',
              ...(isCurrent ? { borderLeft: '2px solid #E6C858', background: 'rgba(230,200,88,.10)' } : null),
            };
            const numColor = isCurrent || isDone ? '#E6C858' : '#77746A';
            const labelStyle = isCurrent
              ? { fontSize: 16.5, color: '#FFFFFF', fontWeight: 600 }
              : { fontSize: 14.5, color: isDone ? '#D8D5CB' : '#8C8880' };
            const inner = (
              <>
                <WaveIcon dim={!isCurrent && !isDone} />
                <span style={{ fontSize: 12, width: 16, flex: 'none', fontWeight: 500, color: numColor }}>
                  {String(step.n).padStart(2, '0')}
                </span>
                <span style={labelStyle}>{step.label}</span>
              </>
            );
            if (isDone && briefId) {
              return (
                <Link key={step.n} href={`/brief/${briefId}/${step.path}`} style={rowStyle} className="tfa-step-item tfa-step-row">
                  {inner}
                </Link>
              );
            }
            return (
              <div key={step.n} style={rowStyle} className="tfa-step-item">
                {inner}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', margin: '24px 0' }}>
          {[6, 10, 14, 10, 6].map((h, i) => (
            <span key={i} style={{ display: 'block', width: 3, height: h, borderRadius: 2, background: '#E6C858', opacity: 0.55 }} />
          ))}
        </div>

        {/* Replaces the old "Team TFA" contact card that used to sit here —
            a static blurb with nothing actionable in it. The autosave/resume
            card is more useful in this bottom-of-sidebar spot. */}
        {brief && briefId && (
          <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid #33301F' }}>
            <ResumeCard briefId={briefId} defaultEmail={brief.contactEmail} />
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1, minWidth: 0, height: '100%', background: '#FFFFFF', padding: '56px 60px',
          position: 'relative', overflowY: 'auto',
        }}
        className="tfa-content"
      >
        {bigNum ? (
          <div style={{ position: 'absolute', top: -2, right: 8, fontWeight: 700, fontSize: 130, lineHeight: 1, color: '#1D1D1D', opacity: 0.05, zIndex: 0, pointerEvents: 'none' }}>
            {bigNum}
          </div>
        ) : null}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {backHref ? (
            <div style={{ marginBottom: 18 }}>
              <a href={backHref} style={{ fontSize: 12, color: '#8C8880', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                ← {backLabel || 'Terug'}
              </a>
            </div>
          ) : null}
          {kicker ? (
            <div style={{ fontSize: 13, letterSpacing: '.09em', textTransform: 'uppercase', color: '#383209', fontWeight: 500 }}>{kicker}</div>
          ) : null}
          {title ? (
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600, fontSize: 36, margin: '8px 0 6px', color: '#1D1D1D' }}>
              {title}
            </h2>
          ) : null}
          {hint ? <p style={{ fontSize: 13.5, lineHeight: 1.55, color: '#5C5850', margin: '0 0 26px' }}>{hint}</p> : null}
          {children}
        </div>
      </div>

      <style jsx>{`
        .tfa-shell-wipe {
          position: fixed;
          inset: 0;
          background: #E6C858;
          z-index: 9999;
          pointer-events: none;
          animation: tfa-shell-wipe-out .5s cubic-bezier(.76, 0, .24, 1) both;
        }
        @keyframes tfa-shell-wipe-out {
          0% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        @media (max-width: 900px) {
          .tfa-shell {
            flex-direction: column;
            height: auto;
            overflow: visible;
          }
          .tfa-sidebar {
            flex: none;
            width: 100%;
            height: auto;
            overflow: visible;
          }
          .tfa-content {
            height: auto;
            overflow: visible;
            padding: 32px 24px;
          }
        }
        .tfa-step-item {
          background: transparent;
          border-left: 2px solid transparent;
        }
        .tfa-step-row {
          transition: background .15s ease, color .15s ease;
        }
        .tfa-step-row:hover {
          background: rgba(255, 255, 255, .08);
        }
      `}</style>
    </div>
  );
}
