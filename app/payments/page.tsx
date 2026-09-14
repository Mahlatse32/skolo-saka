'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './payments.module.css';
import { SecondaryMobileNavigation } from '../SecondaryShell';

type SchoolRow = {
  id: string;
  name: string;
  level: string;
  province: string;
  town: string | null;
  amount_cents: number;
  commitment_id: string | null;
  commitment_status: string | null;
  payment_instruction_id: string | null;
  payment_provider: string | null;
  payment_subscription_code: string | null;
};

type Instruction = {
  id: string;
  kind: 'one_off' | 'recurring';
  cadence: string | null;
  term_months: number | null;
  amount_cents: number;
  currency: string;
  status: string;
  provider: string;
  provider_plan_code: string | null;
  provider_subscription_code: string | null;
  provider_reference: string | null;
  next_payment_at: string | null;
  started_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  allocations: Array<{ id: string; school_id: string; commitment_id: string | null; amount_cents: number; school: { name: string; level: string } | null }>;
};

type Legacy = {
  id: string;
  school_id: string;
  amount_cents: number;
  status: string;
  provider_reference: string | null;
  payment_plan_code: string | null;
  payment_subscription_code: string;
  started_at: string | null;
  school: { name: string; level: string } | null;
};

type Overview = { contributions: Array<{id:string;amount_cents:number;occurred_at:string;schools:{name:string}|{name:string}[]|null}>; paymentMode: 'live' | 'test' | 'unavailable'; schools: SchoolRow[]; instructions: Instruction[]; legacy: Legacy[] };
type PaymentKind = 'recurring' | 'one_off';

const money = (cents: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
const activeStatuses = new Set(['pending','active','non_renewing']);

function levelLabel(level: string) {
  if (level === 'primary') return 'Primary school';
  if (level === 'high') return 'High school';
  if (level === 'combined') return 'Combined school';
  return 'School';
}

export default function PaymentsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [kind, setKind] = useState<PaymentKind>('recurring');
  const [term, setTerm] = useState<string>('forever');
  const [customTerm, setCustomTerm] = useState('12');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [linkLater, setLinkLater] = useState(true);
  const [receiptEmail, setReceiptEmail] = useState('');
  const [draftAmount, setDraftAmount] = useState('10');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [contributions, setContributions] = useState<Overview['contributions'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  useEffect(() => { setConsent(false); }, [kind, term, customTerm, selected, amounts, linkLater, draftId, draftAmount]);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { void load(); }, []);

  async function authedFetch(url: string, init?: RequestInit) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sign in to Skolo Saka first.');
    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(init?.headers || {}),
      },
    });
  }

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await authedFetch('/api/payments/overview');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load payments.');
      setOverview(data as Overview);
      setAmounts(Object.fromEntries((data.schools || []).map((school: SchoolRow) => [school.id, Math.max(1000, Number(school.amount_cents || 1000))])));
      const locked = recurringLockedSchoolIds(data as Overview);
      setSelected(new Set((data.schools || []).filter((school: SchoolRow) => !locked.has(school.id)).map((school: SchoolRow) => school.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load payments.');
    } finally { setLoading(false); }
  }

  function recurringLockedSchoolIds(data: Overview | null = overview) {
    const ids = new Set<string>();
    if (!data) return ids;
    for (const instruction of data.instructions) {
      if (instruction.kind === 'recurring' && activeStatuses.has(instruction.status)) {
        instruction.allocations.forEach(allocation => ids.add(allocation.school_id));
      }
    }
    data.legacy.forEach(row => ids.add(row.school_id));
    return ids;
  }

  const recurringLocked = useMemo(() => recurringLockedSchoolIds(), [overview]);

  useEffect(() => {
    if (!overview) return;
    if (kind === 'one_off') {
      if (selected.size === 0) setSelected(new Set(overview.schools.map(s => s.id)));
      return;
    }
    setSelected(prev => {
      const next = new Set([...prev].filter(id => !recurringLocked.has(id)));
      if (next.size === 0) overview.schools.filter(s => !recurringLocked.has(s.id)).forEach(s => next.add(s.id));
      return next;
    });
  }, [kind, overview, recurringLocked.size]);

  const selectedSchools = useMemo(() => overview?.schools.filter(s => selected.has(s.id)) || [], [overview, selected]);
  const allocatedTotal = selectedSchools.reduce((sum, school) => sum + (amounts[school.id] || 1000), 0);
  const total = linkLater ? Math.round(Number(draftAmount) * 100) || 0 : allocatedTotal;
  const currentInstructions = overview?.instructions.filter(row => activeStatuses.has(row.status)) || [];
  const history = overview?.instructions.filter(row => !activeStatuses.has(row.status)) || [];

  function toggleSchool(id: string) {
    if (kind === 'recurring' && recurringLocked.has(id)) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function updateAmount(id: string, rand: number) {
    const cents = Math.max(1000, Math.round((Number.isFinite(rand) ? rand : 10) * 100));
    setAmounts(prev => ({ ...prev, [id]: cents }));
  }

  function resolvedTermMonths() {
    if (kind !== 'recurring' || term === 'forever') return null;
    if (term === 'custom') return Number(customTerm);
    return Number(term);
  }

  function linkDraft(row: Instruction) {
    setDraftId(row.id); setLinkLater(true); setKind(row.kind);
    setTerm(row.term_months ? String(row.term_months) : 'forever');
    if (row.term_months && ![3,6,12,24,36].includes(row.term_months)) {
      setTerm('custom'); setCustomTerm(String(row.term_months));
    }
    setDraftAmount(String(row.amount_cents / 100));
    const available = overview?.schools.filter(s => row.kind === 'one_off' || !recurringLocked.has(s.id)) || [];
    setSelected(new Set(available.slice(0, 1).map(s => s.id)));
    if (available[0]) setAmounts(prev => ({ ...prev, [available[0].id]: row.amount_cents }));
    setMessage('Review your saved amount and confirm checkout. Choosing a school is optional. Your saved arrangement has not been charged.');
    document.getElementById('payment-setup')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function loadHistory() {
    setHistoryLoading(true); setError('');
    try {
      const response = await authedFetch('/api/payments/history');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load contributions.');
      setContributions(data.contributions);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load contributions.'); }
    finally { setHistoryLoading(false); }
  }

  async function startPayment() {
    setError(''); setMessage('');
    if (!consent) { setError('Confirm the payment terms before continuing.'); return; }
    if (!Number.isSafeInteger(total) || total < 1000 || total > 100_000_000) { setError('Enter a contribution between R10 and R1,000,000.'); return; }
    const termMonths = resolvedTermMonths();
    if (kind === 'recurring' && termMonths !== null && (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 1200)) {
      setError('Choose a term between 1 and 1200 months.'); return;
    }
    setBusy(true);
    try {
      const response = await authedFetch('/api/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          draftId,
          email: receiptEmail,
          consent,
          termMonths,
          amountCents: total,
          allocations: linkLater ? [] : selectedSchools.map(school => ({ schoolId: school.id, amountCents: amounts[school.id] || 1000 })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not start payment.');
      window.location.assign(data.authorizationUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start payment.');
      setBusy(false);
    }
  }

  async function cancelInstruction(instructionId: string) {
    if (!window.confirm('Cancel this arrangement? Any future scheduled charges will stop.')) return;
    setCancelling(instructionId); setError(''); setMessage('');
    try {
      const response = await authedFetch('/api/payments/cancel', { method: 'POST', body: JSON.stringify({ instructionId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not cancel payment.');
      setMessage(data.status === 'non_renewing' ? 'Cancellation requested. Paystack will not renew this payment.' : 'Payment cancelled.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not cancel payment.'); }
    finally { setCancelling(null); }
  }

  async function cancelLegacy(commitmentId: string) {
    if (!window.confirm('Cancel this older individual monthly payment?')) return;
    setCancelling(commitmentId); setError(''); setMessage('');
    try {
      const response = await authedFetch('/api/payments/cancel', { method: 'POST', body: JSON.stringify({ legacyCommitmentId: commitmentId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not cancel payment.');
      setMessage('Individual payment cancelled. You can now include that school in one combined monthly payment.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not cancel payment.'); }
    finally { setCancelling(null); }
  }


  return <main className={styles.page}>
    <div className={styles.shell}>
      <div className={styles.topbar}><a className={styles.back} href="/">← Back to Skolo Saka</a><div className={styles.brand}>Skolo Saka</div></div>

      <header className={styles.compactHero}><span className={styles.eyebrow}>Payments</span><h1>Support starts here.</h1><p>Donate once or monthly. Choosing a school is optional.</p></header>
      {loading && <p role="status">Loading your saved arrangements…</p>}
      {overview && overview.paymentMode !== 'live' && <div className={styles.notice} role="status">{overview?.paymentMode === 'test' ? 'Demo checkout: test payments only. No real contribution will be collected.' : 'Secure checkout is temporarily unavailable. Please try again shortly.'}</div>}
      {error && <div className={styles.error} role="alert">{error}{!overview && !loading && <button onClick={() => void load()}>Try again</button>}</div>}
      {message && <div className={styles.success}>{message}</div>}
      {!!overview?.legacy.length && <div className={styles.notice}>You still have older individual school subscriptions. Cancel those below before adding the same schools to one combined monthly payment.</div>}

      <div className={styles.layout}>
        <section className={styles.card} id="payment-setup">
          <div className={styles.sectionTitle}><div><h2>Set up a payment</h2><p>Start from R10. Confirm your donation securely with Paystack.</p></div></div>
          <div className={styles.toggle}>
            <button className={kind === 'recurring' ? styles.active : ''} onClick={() => setKind('recurring')}>Monthly</button>
            <button className={kind === 'one_off' ? styles.active : ''} onClick={() => setKind('one_off')}>Once-off</button>
          </div>

          {kind === 'recurring' && <div className={styles.termRow}>
            <div><label htmlFor="term">How long?</label><div className={styles.fineprint}>Continue until cancelled, or choose a fixed number of monthly payments.</div></div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}><select id="term" value={term} onChange={e => setTerm(e.target.value)}><option value="forever">Until cancelled</option><option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option><option value="24">24 months</option><option value="36">36 months</option><option value="custom">Custom</option></select>{term === 'custom' && <input className={styles.customTerm} type="number" min={1} max={1200} value={customTerm} onChange={e => setCustomTerm(e.target.value)} aria-label="Custom term in months"/>}</div>
          </div>}

          <div className={styles.toggle} aria-label="School allocation">
            <button aria-pressed={linkLater} className={linkLater ? styles.active : ''} onClick={() => setLinkLater(true)}>No school</button>
            <button aria-pressed={!linkLater} className={!linkLater ? styles.active : ''} onClick={() => setLinkLater(false)}>Choose schools now</button>
          </div>
          {draftId && <p className={styles.notice}>Continue your saved arrangement. <button type="button" onClick={() => { setDraftId(null); setLinkLater(true); }}>Back to new arrangement</button></p>}
          {linkLater ? <div className={styles.termRow}><label htmlFor="draft-amount">{kind === 'recurring' ? 'Monthly amount (R)' : 'Once-off amount (R)'}</label><input id="draft-amount" className={styles.amount} type="number" min="10" max="1000000" step="0.01" value={draftAmount} onChange={e => setDraftAmount(e.target.value)}/></div> : <div className={styles.schools}>
            {overview?.schools.map(school => {
              const locked = kind === 'recurring' && recurringLocked.has(school.id);
              const isSelected = selected.has(school.id) && !locked;
              return <label key={school.id} className={`${styles.schoolRow} ${isSelected ? styles.selected : ''} ${locked ? styles.disabled : ''}`}>
                <input className={styles.check} type="checkbox" checked={isSelected} disabled={locked} onChange={() => toggleSchool(school.id)}/>
                <div className={styles.schoolCopy}><b>{school.name}</b><small>{levelLabel(school.level)} · {school.town || school.province}</small></div>
                {locked ? <div className={styles.locked}>Already linked to a monthly arrangement</div> : <div className={styles.amountWrap}><span>R</span><input className={styles.amount} type="number" min={10} step={5} value={(amounts[school.id] || 1000) / 100} onChange={e => updateAmount(school.id, Number(e.target.value))} disabled={!isSelected}/></div>}
              </label>;
            })}
            {!loading && !overview?.schools.length && <div className={styles.empty}>No linked schools yet. Choose “No school” above to donate immediately.</div>}
          <a className={styles.back} href="/schools">Find and add a school →</a></div>}
          <div className={styles.termRow}><div><label htmlFor="receipt-email">Email for payment receipts</label><p className={styles.fineprint}>Leave blank to use your saved email.</p></div><input id="receipt-email" type="email" autoComplete="email" value={receiptEmail} onChange={e => setReceiptEmail(e.target.value)} style={{maxWidth:'100%',minWidth:0}}/></div>
        </section>

        <aside className={styles.summary}>
          <div className={styles.summaryBox}>
            <h3>Payment summary</h3>
            <div className={styles.summaryLine}><span>Type</span><strong>{kind === 'recurring' ? 'Monthly' : 'Once-off'}</strong></div>
            <div className={styles.summaryLine}><span>Schools</span><strong>{linkLater ? 'None — optional' : selectedSchools.length}</strong></div>
            {kind === 'recurring' && <div className={styles.summaryLine}><span>Term</span><strong>{resolvedTermMonths() ? `${resolvedTermMonths()} months` : 'Until cancelled'}</strong></div>}
            <div className={styles.total}><span>{kind === 'recurring' ? 'Monthly amount' : 'Once-off amount'}</span><strong>{money(total)}</strong></div>
            <>
              <p className={styles.summaryHint}>{kind === 'recurring' ? 'Your card is charged at checkout, then monthly.' : 'Your card is charged once at checkout.'} {linkLater ? 'Your donation is recorded without a school allocation.' : 'Contributions are allocated to your selected schools.'}</p>
              <p className={styles.summaryHint}>Card details are entered securely with Paystack. Processing fees are deducted from contributions.</p>
              <label className={styles.consent}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>{kind === 'recurring' ? `I authorise ${money(total)} now and monthly ${resolvedTermMonths() ? `for ${resolvedTermMonths()} payments in total` : 'until I cancel'}.` : `I confirm a once-off contribution of ${money(total)}.`}</span></label>
              <button className={styles.primary} onClick={startPayment} disabled={busy || !consent || !Number.isSafeInteger(total) || total < 1000 || total > 100_000_000 || overview?.paymentMode === 'unavailable'}>{busy ? 'Opening secure checkout…' : 'Continue to secure checkout'}</button>
            </>
          </div>
        </aside>
      </div>

      <section className={styles.activeSection}>
        <h2>Your payment arrangements</h2>
        <div className={styles.paymentGrid}>
          {currentInstructions.map(row => <article className={styles.paymentCard} key={row.id}><div className={styles.paymentHead}><div><h3>{row.kind === 'recurring' ? 'Monthly arrangement' : 'Once-off arrangement'}</h3><div className={styles.legacyTag}>{row.provider === 'draft' ? 'No card linked · No charge' : row.provider === 'paystack' ? 'Paystack' : row.provider}</div></div><span className={`${styles.status} ${row.status === 'pending' ? styles.pending : row.status === 'non_renewing' ? styles.nonrenewing : ''}`}>{row.provider === 'draft' ? 'Awaiting checkout' : row.status.replace('_',' ')}</span></div><div className={styles.paymentMeta}><span><b>{money(row.amount_cents)}</b>{row.kind === 'recurring' ? '/month' : ''}</span>{row.kind === 'recurring' && <span>{row.term_months ? `${row.term_months} month term` : 'Until cancelled'}</span>}</div>{row.next_payment_at && <p className={styles.fineprint}>Next payment: {new Date(row.next_payment_at).toLocaleDateString('en-ZA')}</p>}<div className={styles.allocations}>{!row.allocations.length && row.provider !== 'draft' && <p className={styles.fineprint}>Donation without a school allocation</p>}{row.allocations.map(a => <div className={styles.allocation} key={a.id}><span>{a.school?.name || 'School'}</span><span>{money(a.amount_cents)}</span></div>)}</div>{row.provider === 'draft' && <button className={styles.linkButton} disabled={busy || loading} onClick={() => linkDraft(row)}>Continue to checkout</button>}{(row.kind === 'recurring' || row.provider === 'draft') && <button className={styles.danger} disabled={cancelling === row.id || row.status === 'non_renewing'} onClick={() => cancelInstruction(row.id)}>{row.status === 'non_renewing' ? 'Cancellation requested' : cancelling === row.id ? 'Cancelling…' : row.provider === 'draft' ? 'Delete arrangement' : 'Cancel monthly payment'}</button>}</article>)}

          {overview?.legacy.map(row => <article className={`${styles.paymentCard} ${styles.legacy}`} key={row.id}><div className={styles.paymentHead}><div><h3>{row.school?.name || 'School'}</h3><div className={styles.legacyTag}>Older individual Paystack subscription</div></div><span className={styles.status}>{row.status}</span></div><div className={styles.paymentMeta}><span><b>{money(row.amount_cents)}</b>/month</span></div><button className={styles.danger} disabled={cancelling === row.id} onClick={() => cancelLegacy(row.id)}>{cancelling === row.id ? 'Cancelling…' : 'Cancel individual payment'}</button></article>)}

          {!loading && !currentInstructions.length && !overview?.legacy.length && <div className={styles.empty}>No active payments yet. Set one up above.</div>}
        </div>
      </section>

      <button className={styles.linkButton} onClick={loadHistory} disabled={historyLoading}>{historyLoading ? 'Loading contributions…' : 'View contribution history'}</button>
      {contributions?.length === 0 && <p>No contributions received yet.</p>}
      {!!contributions?.length && <section className={styles.historySection}><h2>Contributions received</h2><p className={styles.fineprint}>Your latest 100 contribution entries, before processing fees. Donations without a school are included. A combined payment appears once per school.</p><div className={styles.historyCard}>{contributions!.map(row=><div className={styles.historyRow} key={row.id}><div><b>{(Array.isArray(row.schools)?row.schools[0]:row.schools)?.name || 'Donation — no school allocation'}</b><small>{new Date(row.occurred_at).toLocaleDateString('en-ZA')}</small></div><span className={styles.historyStatus}>Received</span><span className={styles.historyAmount}>{money(row.amount_cents)}</span></div>)}</div></section>}
      {!!history.length && <section className={styles.historySection}><h2>Past payment arrangements</h2><div className={styles.historyCard}>{history.map(row => <div className={styles.historyRow} key={row.id}><div><b>{row.kind === 'recurring' ? 'Monthly payment' : 'Once-off payment'} · {row.allocations.map(a => a.school?.name).filter(Boolean).join(', ')}</b><small>{new Date(row.created_at).toLocaleDateString('en-ZA')}</small></div><span className={styles.historyStatus}>{row.status.replace('_',' ')}</span><span className={styles.historyAmount}>{money(row.amount_cents)}</span></div>)}</div></section>}
    </div>
    <SecondaryMobileNavigation active="payments"/>
  </main>;
}
