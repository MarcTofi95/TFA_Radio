// Shared static data/constants for the 7-step client brief flow. Ported
// verbatim (ids, labels, ordering) from the original public/*.html pages,
// since they're used across the shared StepShell + useBrief hook approach
// instead of being duplicated per page.

export const STEPS = [
  { n: 1, label: 'Contact', path: 'contact' },
  { n: 2, label: 'Levering', path: 'delivery' },
  { n: 3, label: 'Brief', path: 'details' },
  { n: 4, label: 'Script', path: 'script' },
  { n: 5, label: 'Stem', path: 'voice' },
  { n: 6, label: 'Muziek', path: 'music' },
  { n: 7, label: 'Overzicht', path: 'overview' },
];

// Mirrors applyReachableSteps() duplicated across every original HTML page:
// marks a step reachable once the brief has real data implying the client
// got that far, even if they're currently earlier in the flow (so going
// back never stunts forward navigation).
//
// Step 7 (Overzicht) used to only count as "reached" once brief.submittedAt
// was set — i.e. only after the whole flow was already finished. That meant
// clicking a "Wijzig" link from the overview (which jumps back to an
// earlier step to edit something, well before submitting) made Overzicht
// gray out in the sidebar immediately, since it hadn't been submitted yet —
// the client then had to click all the way forward through every step
// again just to get back to it. Overzicht doesn't collect its own data, so
// it should be reachable as soon as there's enough approved data to show
// there — the exact same check the overview page itself uses to enable its
// "Bevestigen en versturen" button — not only once the whole thing has
// already been sent.
export function computeReached(brief) {
  if (!brief) return {};
  let tracks = [];
  try {
    const parsed = brief.selectedTracks ? JSON.parse(brief.selectedTracks) : [];
    if (Array.isArray(parsed)) tracks = parsed;
  } catch (e) {}
  const hasScript = !!(brief.generatedScript || brief.editedScript);
  return {
    2: !!(brief.impressions || brief.airDate || brief.dateUnknown),
    3: !!(brief.product || brief.usp || brief.mainMessage),
    4: hasScript,
    5: !!brief.selectedVoiceId,
    6: tracks.length > 0,
    7: !!brief.submittedAt || (hasScript && !!brief.selectedVoiceId && tracks.length > 0),
  };
}

export const TONE_LABELS = {
  energiek: 'Energiek', rustig: 'Rustig', warm: 'Warm', zakelijk: 'Zakelijk',
  urgent: 'Urgent', premium: 'Premium', speels: 'Speels', grappig: 'Grappig',
  betrouwbaar: 'Betrouwbaar', gedurfd: 'Gedurfd', inspirerend: 'Inspirerend',
  nostalgisch: 'Nostalgisch',
};

// The client-facing voice (step 5) and music (step 6) pages used to pick
// from fixed sample pools here (VOICE_POOL, PLAYLISTS) — hard-coded example
// voices/tracks that never reflected anything a producer actually added in
// /dashboard/library. Both pages now fetch the real library over
// GET /api/library/voices and GET /api/library/tracks instead, so those
// pools have been removed. AGE_LABELS stays: it's still the shared display
// mapping for the age-range question/answers on both the library form and
// the voice step, and its keys ('18-34'/'35-54'/'55+') match the real
// voices' ageRange field.
export const AGE_LABELS = { '18-34': '18–34', '35-54': '35–54', '55+': '55+' };

export const MONTH_NAMES = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
export const MONTH_NAMES_LOWER = MONTH_NAMES.map((m) => m.toLowerCase());

export function estimateSeconds(words) {
  return (words / 2.7) * 1.05;
}
export function wordCountOf(text) {
  const t = (text || '').trim();
  return t ? t.split(/\s+/).length : 0;
}
