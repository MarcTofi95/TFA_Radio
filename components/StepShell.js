'use client';

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
        <h1
          style={{
            fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600, fontSize: 24,
            color: companyName ? '#FFFFFF' : '#8C897E', margin: '16px 0 0', lineHeight: 1.3,
          }}
        >
          {companyName || 'Nog geen bedrijfsnaam'}
        </h1>
        {subtitle ? <div style={{ fontSize: 11.5, color: '#B9B6AC', marginTop: 4 }}>{subtitle}</div> : null}

        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {STEPS.map((step) => {
            const isCurrent = step.n === current;
            const isDone = !isCurrent && (step.n < current || !!reached[step.n]);
            const rowStyle = {
              display: 'flex', alignItems: 'center', gap: 10, padding: isCurrent ? '10px 12px' : '9px 10px',
              borderLeft: isCurrent ? '2px solid #E6C858' : '2px solid transparent',
              background: isCurrent ? 'rgba(230,200,88,.10)' : 'transparent',
              borderRadius: '0 6px 6px 0', textDecoration: 'none', cursor: isDone ? 'pointer' : 'default',
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
                <Link key={step.n} href={`/brief/${briefId}/${step.path}`} style={rowStyle} className="tfa-step-row">
                  {inner}
                </Link>
              );
            }
            return (
              <div key={step.n} style={rowStyle}>
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

        <div style={{ marginTop: 'auto', display: 'flex', gap: 10, alignItems: 'flex-start', paddingTop: 20, borderTop: '1px solid #33301F' }}>
          <div
            style={{
              width: 34, height: 34, borderRadius: '50%', background: '#E6C858', color: '#1D1D1D', fontWeight: 700,
              fontSize: 11.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
            }}
          >
            TFA
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: '#FFFFFF' }}>Team TFA</div>
            <div style={{ fontSize: 13.5, color: '#B9B6AC', marginTop: 2, lineHeight: 1.4 }}>
              Jouw team bij TFA — we houden dit traject in de gaten van brief tot uitzending.
            </div>
          </div>
        </div>
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
        .tfa-step-row:hover {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
}
