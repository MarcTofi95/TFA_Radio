'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StepShell from '../../../../components/StepShell';
import Preloader from '../../../../components/Preloader';
import useMinDelay from '../../../../components/useMinDelay';
import { useBrief } from '../../../../components/useBrief';

// Step 1 — mirrors public/contact.html.
export default function ContactPage({ params }) {
  const { id } = params;
  const router = useRouter();
  const { brief, loading, saveState, schedulePatch, flushPending, patch } = useBrief(id);
  const showLoader = useMinDelay(loading, 2000);
  const [form, setForm] = useState({ companyName: '', contactPerson: '', contactEmail: '' });

  // Hydrate local form state from the fetched brief ONLY once, on first
  // load — not on every subsequent `brief` update. patch() also calls
  // setBrief() with the server's echoed row after every autosave, and this
  // effect used to depend on the whole `brief` object, so it re-ran on every
  // save and stomped the form with whatever had been sent moments earlier —
  // dropping/glitching characters typed in the interim, and (worse, on other
  // steps) resetting local UI state derived from the brief. Depending on the
  // id instead of the object means it only fires once per brief.
  useEffect(() => {
    if (brief) {
      setForm({
        companyName: brief.companyName || '',
        contactPerson: brief.contactPerson || '',
        contactEmail: brief.contactEmail || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief && brief.id]);

  function update(field, value) {
    const next = { ...form, [field]: value };
    setForm(next);
    schedulePatch({ [field]: value });
  }

  async function next() {
    flushPending();
    await patch(form);
    router.push(`/brief/${id}/delivery`);
  }

  if (showLoader) return <Preloader />;

  return (
    <StepShell briefId={id} current={1} brief={brief} bigNum="01" kicker="Wie ben je" title="Jouw gegevens">
      <div className="field-grid">
        <div className="full">
          <label className="field-label">Bedrijfsnaam</label>
          <input type="text" value={form.companyName} placeholder="Bijv. Aspire Analytics" onChange={(e) => update('companyName', e.target.value)} />
        </div>
        <div>
          <label className="field-label">Contactpersoon</label>
          <input type="text" value={form.contactPerson} placeholder="Voor- en achternaam" onChange={(e) => update('contactPerson', e.target.value)} />
        </div>
        <div>
          <label className="field-label">E-mailadres</label>
          <input type="text" value={form.contactEmail} placeholder="naam@bedrijf.nl" onChange={(e) => update('contactEmail', e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 36, paddingTop: 22, borderTop: '1px solid #EAE7DE', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <button type="button" className="btn-primary" style={{ width: 320, flex: 'none' }} onClick={next}>
          Volgende — verder naar je commercial
        </button>
        <div style={{ fontSize: 11, color: '#8C8880', textAlign: 'center', marginTop: 10, height: 14 }}>{saveState}</div>
      </div>
    </StepShell>
  );
}
