'use client';

import { useEffect, useState } from 'react';
import StepShell from '../../../../components/StepShell';
import Preloader from '../../../../components/Preloader';
import useMinDelay from '../../../../components/useMinDelay';
import { useBrief } from '../../../../components/useBrief';
import { MONTH_NAMES_LOWER } from '../../../../components/flowData';
import { diffWords, hasDiff, DiffText } from '../../../../components/textDiff';

function formatImpressions(brief) {
  const v = brief.impressions;
  if (!v) return 'Niet opgegeven';
  if (v === 'meer') return brief.impressionsCustom ? brief.impressionsCustom + ' impressies' : 'Meer dan 500.000 impressies';
  const n = parseInt(v, 10);
  return (isNaN(n) ? v : n.toLocaleString('nl-NL')) + ' impressies';
}
function formatAirDate(brief) {
  if (brief.dateUnknown) {
    if (brief.airMonth) {
      const idx = parseInt(brief.airMonth, 10) - 1;
      const name = MONTH_NAMES_LOWER[idx];
      return name ? 'Nog niet exact bekend — gepland voor ' + name : 'Nog niet bekend';
    }
    return 'Nog niet bekend';
  }
  if (brief.airDate) {
    const d = new Date(brief.airDate + 'T00:00:00');
    if (!isNaN(d.getTime())) return d.getDate() + ' ' + MONTH_NAMES_LOWER[d.getMonth()] + ' ' + d.getFullYear();
    return brief.airDate;
  }
  return 'Nog niet opgegeven';
}

// Step 7 — mirrors public/overview.html. CRITICAL: this is the ONLY place
// in the whole flow that sends {submitted:true} — no other step may ever
// send it, since that flag means "the whole 7-step flow is done, fire the
// confirmation email".
export default function OverviewPage({ params }) {
  const { id } = params;
  const { brief, loading, patch } = useBrief(id);
  const showLoader = useMinDelay(loading, 700);
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voicesPool, setVoicesPool] = useState([]);
  const [tracksPool, setTracksPool] = useState([]);

  useEffect(() => {
    setConsentChecked(false);
  }, [id]);

  // The brief only stores the chosen voice/track ids + labels, not their
  // audioUrl — fetch the full library records once so the overview can play
  // a preview of what the client actually picked, same as the voice/music
  // steps do.
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch('/api/library/voices'), fetch('/api/library/tracks')])
      .then(async ([vRes, tRes]) => {
        const [v, t] = await Promise.all([vRes.json(), tRes.json()]);
        if (!cancelled) {
          setVoicesPool(Array.isArray(v) ? v : []);
          setTracksPool(Array.isArray(t) ? t : []);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (showLoader) return <Preloader />;

  if (!brief) {
    return (
      <StepShell briefId={id} current={7} brief={null} bigNum="07" kicker="Jouw mandje" title="Alles op een rij">
        <div style={{ background: '#FBF3F1', border: '1px solid #C2513F', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: '#C2513F' }}>
          Geen brief gevonden bij deze link.
        </div>
      </StepShell>
    );
  }

  const companyName = brief.companyName && brief.companyName.trim() ? brief.companyName : 'Nog geen bedrijfsnaam';
  const spotLength = brief.hoofdspotLength || '20';
  const mainText = brief.editedScript !== null && brief.editedScript !== undefined ? brief.editedScript : brief.generatedScript || '';
  const varText = brief.editedVarScript !== null && brief.editedVarScript !== undefined ? brief.editedVarScript : brief.generatedVarScript || '';
  const voiceLabel = brief.selectedVoiceLabel || '';
  const voiceTags = brief.selectedVoiceTags ? brief.selectedVoiceTags.split(',').filter(Boolean) : [];
  let selectedTracks = [];
  try {
    selectedTracks = brief.selectedTracks ? JSON.parse(brief.selectedTracks) : [];
    if (!Array.isArray(selectedTracks)) selectedTracks = [];
  } catch (e) {}

  const hasTracks = selectedTracks.length > 0;
  const matchedVoice = brief.selectedVoiceId ? voicesPool.find((v) => v.id === brief.selectedVoiceId) : null;
  const briefReady = !!(brief.editedScript || brief.generatedScript) && !!brief.selectedVoiceId && hasTracks;

  async function submit() {
    if (!briefReady || !consentChecked) return;
    setSubmitting(true);
    await patch({ submitted: true });
    setSubmitting(false);
  }

  if (brief.submittedAt) {
    return (
      <StepShell briefId={id} current={7} brief={brief} bigNum="07" kicker="Verzonden naar TFA" title={'Bedankt, ' + companyName + '!'}>
        <div style={{ maxWidth: 540 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E6C858', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>✓</div>
          <p style={{ fontSize: 15.5, lineHeight: 1.65, color: '#5C5850', margin: '0 0 18px' }}>
            Je radiocommercial is succesvol verzonden naar TFA. Ons team gaat er nu mee aan de slag — van opname tot montage —
            zodat alles op tijd klaarstaat voor uitzending.
          </p>
          <div style={{ background: '#FBF9EC', border: '1px solid #EAE3C4', borderRadius: 12, padding: '16px 18px', fontSize: 13.5, lineHeight: 1.55, color: '#5C5850' }}>
            Je ontvangt ook een bevestiging per e-mail (vanaf <b style={{ color: '#1D1D1D' }}>planning@tfa.studio</b>) met een overzicht van al je keuzes — bewaar &apos;m gerust.
          </div>
          <div style={{ marginTop: 26, fontSize: 13.5, lineHeight: 1.5, color: '#5C5850' }}>
            Vragen tussendoor? Neem contact op met <b style={{ color: '#1D1D1D' }}>Team TFA</b> via{' '}
            <a href="mailto:planning@tfa.studio">planning@tfa.studio</a>.
          </div>
        </div>
      </StepShell>
    );
  }

  // Three sizes of the same "box on its own" card, so the review reads as a
  // hierarchy instead of a flat stack of identical blocks: the admin-y
  // details (contact/delivery) are compact and side by side, the actual
  // creative deliverable (script) is the visual centerpiece with a bigger
  // heading and a soft gold glow, and stem/muziek sit in between — full
  // width like the script (so a single card never dead-ends halfway across
  // the row the way "Stem" used to when it had no partner card beside it).
  const cardBase = { background: '#FBF9EC', border: '1.5px solid #EAE3C4', borderLeft: '4px solid #E6C858', borderRadius: '4px 14px 14px 4px' };
  const compactCardStyle = { ...cardBase, padding: '16px 18px', marginBottom: 14 };
  const standardCardStyle = { ...cardBase, padding: '22px 24px', marginBottom: 14 };
  const featureCardStyle = {
    ...cardBase, padding: '30px 32px', marginBottom: 18,
    border: '1.5px solid #E6C858', borderLeft: '5px solid #E6C858',
    boxShadow: '0 6px 24px rgba(230,200,88,.22)',
  };
  const compactHeaderStyle = { fontSize: 13.5, fontWeight: 600, color: '#5C5850' };
  const standardHeaderStyle = { fontSize: 16, fontWeight: 600 };
  const featureHeaderStyle = { fontSize: 19, fontWeight: 700 };

  return (
    <StepShell briefId={id} current={7} brief={brief} bigNum="07" kicker="Jouw mandje" title="Alles op een rij" hint="Het script, de stem en de muziek die je hebt gekozen — dit is wat TFA gaat opnemen en produceren." backHref={`/brief/${id}/music`} backLabel="Terug naar de muziek">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }} className="tfa-overview-grid">
        <div style={compactCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={compactHeaderStyle}>Jouw gegevens</div>
            <a href={`/brief/${id}/contact`} style={{ fontSize: 11, fontWeight: 600, textDecoration: 'underline' }}>Wijzig</a>
          </div>
          <div style={{ fontSize: 13, marginTop: 9 }}>{companyName}</div>
          <div style={{ fontSize: 13, marginTop: 2, color: brief.contactPerson ? '#1D1D1D' : '#9C9890' }}>{brief.contactPerson || 'Nog geen contactpersoon opgegeven'}</div>
          <div style={{ fontSize: 13, marginTop: 2, color: brief.contactEmail ? '#1D1D1D' : '#9C9890' }}>{brief.contactEmail || 'Nog geen e-mailadres opgegeven'}</div>
        </div>

        <div style={compactCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={compactHeaderStyle}>Levering</div>
            <a href={`/brief/${id}/delivery`} style={{ fontSize: 11, fontWeight: 600, textDecoration: 'underline' }}>Wijzig</a>
          </div>
          <div style={{ fontSize: 13, marginTop: 9 }}>Hoofdspot · {spotLength}″{brief.needsVariations ? ' + variatie' : ''}</div>
          <div style={{ fontSize: 13, marginTop: 2 }}>{formatImpressions(brief)}</div>
          <div style={{ fontSize: 13, marginTop: 2 }}>Eerste uitzending: {formatAirDate(brief)}</div>
        </div>

        <div style={{ ...featureCardStyle, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={featureHeaderStyle}>Script · hoofdspot {spotLength}″</div>
            <a href={`/brief/${id}/script`} style={{ fontSize: 11, fontWeight: 600, textDecoration: 'underline' }}>Wijzig</a>
          </div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: mainText ? 'italic' : 'normal', fontSize: 17.5, lineHeight: 1.7, marginTop: 16, color: mainText ? '#1D1D1D' : '#9C9890' }}>
            {mainText || 'Nog geen script goedgekeurd.'}
          </div>
          {brief.needsVariations && varText && (() => {
            const tokens = diffWords(mainText, varText);
            const changed = hasDiff(tokens);
            return (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #EAE3C4' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#5C5850', textTransform: 'uppercase' }}>
                  Variatie {changed ? '— wat verschilt' : ''}
                </div>
                {changed ? (
                  <div style={{ fontSize: 15, lineHeight: 1.7, marginTop: 6 }}>
                    <DiffText tokens={tokens} />
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#8C8880', marginTop: 6, fontStyle: 'italic' }}>
                    Nog identiek aan het hoofdscript.
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <div style={{ ...standardCardStyle, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={standardHeaderStyle}>Stem</div>
            <a href={`/brief/${id}/voice`} style={{ fontSize: 11, fontWeight: 600, textDecoration: 'underline' }}>Wijzig</a>
          </div>
          <div style={{ fontSize: 13, marginTop: 9, color: voiceLabel ? '#1D1D1D' : '#9C9890' }}>
            {voiceLabel ? voiceLabel + (voiceTags.length ? ' · ' + voiceTags.join(', ') : '') : 'Nog geen stem gekozen.'}
          </div>
          {voiceLabel && (
            matchedVoice && matchedVoice.audioUrl ? (
              <audio controls src={matchedVoice.audioUrl} style={{ width: '100%', height: 34, marginTop: 10 }} />
            ) : (
              <div style={{ fontSize: 11.5, color: '#9C9890', marginTop: 8, fontStyle: 'italic' }}>Geen audio beschikbaar voor deze stem.</div>
            )
          )}
        </div>

        <div style={{ ...standardCardStyle, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={standardHeaderStyle}>Muziek</div>
            <a href={`/brief/${id}/music`} style={{ fontSize: 11, fontWeight: 600, textDecoration: 'underline' }}>Wijzig</a>
          </div>
          {hasTracks ? (
            <>
              {selectedTracks.map((t, i) => {
                const matchedTrack = tracksPool.find((pt) => pt.id === t.id);
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: '8px 10px', background: '#FBF0C8', borderRadius: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#E6C858', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{t.title}</div>
                      <div style={{ fontSize: 11.5, color: '#5C5850' }}>{t.artist}{t.artist && t.playlistName ? ' · ' : ''}{t.playlistName}</div>
                      {matchedTrack && matchedTrack.audioUrl ? (
                        <audio controls src={matchedTrack.audioUrl} style={{ width: '100%', height: 32, marginTop: 6 }} />
                      ) : (
                        <div style={{ fontSize: 11, color: '#8C8880', marginTop: 4, fontStyle: 'italic' }}>Geen audio beschikbaar voor deze track.</div>
                      )}
                    </div>
                  </div>
                );
              })}
              {selectedTracks.length > 1 && <div style={{ fontSize: 11, color: '#8C8880', marginTop: 8 }}>TFA combineert er één van deze met de gekozen stem tot de definitieve mix.</div>}
            </>
          ) : (
            <div style={{ fontSize: 13, color: '#9C9890' }}>Nog geen track gekozen.</div>
          )}
        </div>
      </div>

      <div className="box" style={{ background: '#F7F6F1', border: '1.5px solid #E3E0D5', borderRadius: 14, padding: '18px 20px', marginTop: 22 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>Voorwaarden</div>
        <ul style={{ margin: '9px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.6, color: '#5C5850' }}>
          <li style={{ marginBottom: 6 }}>Het gebruiksrecht op de gekozen voice-over en muziek geldt uitsluitend voor deze specifieke productie, zonder recht op verlenging of hergebruik in toekomstige producties.</li>
          <li style={{ marginBottom: 6 }}>Brengt de klant na goedkeuring en opname van het script alsnog wijzigingen aan, dan worden de kosten van de daaruit voortvloeiende heropname(s) apart in rekening gebracht.</li>
          <li>TFA aanvaardt geen aansprakelijkheid voor vertraging in de levering wanneer deze het gevolg is van het uitblijven van tijdige goedkeuring of feedback van de klant.</li>
        </ul>
      </div>

      <div
        style={{
          marginTop: 22, display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '14px 16px',
          borderRadius: 10, border: '1.5px solid ' + (consentChecked ? '#E6C858' : '#EAE3C4'), background: consentChecked ? '#FBF9EC' : '#FCFBF7',
        }}
        onClick={() => setConsentChecked((c) => !c)}
      >
        <div style={{ flex: 'none', width: 18, height: 18, marginTop: 1, borderRadius: 5, border: '1.5px solid ' + (consentChecked ? '#E6C858' : '#C9C5B9'), background: consentChecked ? '#E6C858' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {consentChecked ? '✓' : ''}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>Nodig om te versturen</span>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#8C6D1F', background: 'rgba(230,200,88,.28)', borderRadius: 4, padding: '2px 6px' }}>Verplicht</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.55, color: '#5C5850' }}>
            Ik geef TFA het groene licht om dit script, deze stem en deze muziek in productie te nemen — en om deze gegevens
            (inclusief het gebruikelijke cookie- en trackingwerk) te gebruiken om dit traject soepel te laten verlopen.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, paddingTop: 22, borderTop: '1px solid #EAE7DE', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        {briefReady && !consentChecked && <div style={{ fontSize: 12, color: '#B08900', fontWeight: 500 }}>↑ Vink het vakje hierboven aan om te versturen</div>}
        <button type="button" className="btn-primary" style={{ width: 320, flex: 'none' }} disabled={!briefReady || !consentChecked || submitting} onClick={submit}>
          Bevestigen en versturen naar TFA
        </button>
      </div>

      <style jsx>{`
        @media (max-width: 700px) {
          .tfa-overview-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </StepShell>
  );
}
