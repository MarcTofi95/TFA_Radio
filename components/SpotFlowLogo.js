import BrandMark from './BrandMark';

// The "TFA SpotFlow" lockup — small uppercase "TFA" sitting above the
// bigger serif "SpotFlow" wordmark, next to the existing brandmark icon.
// This is the parent/sub-brand treatment picked out of the concepts shown
// to the client (their "#3"): it reads as its own product name rather than
// a relabeled "TFA Commercial Productie", while still crediting TFA above
// it. Used everywhere the app previously showed the bare "TFA" wordmark —
// homepage header/footer, sign-in/sign-up, the client-flow sidebar, and
// every dashboard sidebar. The install/PWA icon and browser favicon stay
// the plain TFA brandmark (app/icon.png, app/manifest.js) rather than
// trying to cram this whole lockup into a small square tile.
//
// `textClassName` lets a caller hide just the stacked-text half on a
// narrow layout (e.g. the client-flow mobile rail) while keeping the icon
// visible, the same way the old bare-"TFA" label did.
export default function SpotFlowLogo({ size = 32, variant = 'dark', gap, className, textClassName }) {
  const tfaColor = variant === 'dark' ? '#E6C858' : '#8C6D1F';
  const nameColor = variant === 'dark' ? '#FFFFFF' : '#1D1D1D';
  const nameFontSize = Math.round(size * 0.52);
  const tfaFontSize = Math.max(9, Math.round(size * 0.24));

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: gap != null ? gap : Math.round(size * 0.32) }}>
      <BrandMark size={size} />
      <div className={textClassName} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontFamily: "'Geist', system-ui, sans-serif", fontWeight: 600, fontSize: tfaFontSize,
            letterSpacing: '.16em', textTransform: 'uppercase', color: tfaColor, lineHeight: 1,
          }}
        >
          TFA
        </span>
        <span
          style={{
            fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600, fontSize: nameFontSize,
            color: nameColor, lineHeight: 1,
          }}
        >
          SpotFlow
        </span>
      </div>
    </div>
  );
}
