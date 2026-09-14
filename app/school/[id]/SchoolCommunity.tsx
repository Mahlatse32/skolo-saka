'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './community.module.css';

type Mode = 'classmates' | 'schoolmates';
type Community = { items: Array<{ id: string; name: string; grade: number | null; year: number | null }>; total: number; page: number; pageSize: number; cohort: { grade: number | null; year: number | null }; needsDetails: boolean };

export default function SchoolCommunity({ schoolId }: { schoolId: string }) {
  const [mode, setMode] = useState<Mode>('classmates');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessStatus, setAccessStatus] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [grade, setGrade] = useState('');
  const [year, setYear] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setResult(null); setAccessStatus(0);
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (controller.signal.aborted) return;
        if (!session) { setAccessStatus(401); throw new Error('Sign in to see classmates and schoolmates.'); }
        const response = await fetch(`/api/schools/${schoolId}/community?mode=${mode}&page=${page}`, { headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal, cache: 'no-store' });
        const data = await response.json();
        if (controller.signal.aborted) return;
        setAccessStatus(response.status);
        if (!response.ok) throw new Error(data.error);
        setResult(data); setGrade(String(data.cohort.grade || '')); setYear(String(data.cohort.year || ''));
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load community.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [schoolId, mode, page, refresh]);

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setSaveError(''); setNotice('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in again to save your details.');
      const response = await fetch(`/api/schools/${schoolId}/community`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ grade: Number(grade), year: Number(year) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEditing(false); setPage(1); setRefresh(n => n + 1); setNotice('School details saved. Your matches have been updated.');
    } catch (e) { setSaveError(e instanceof Error ? e.message : 'Could not save details.'); }
    finally { setSaving(false); }
  }

  const pages = Math.max(1, Math.ceil((result?.total || 0) / 10));
  return <section className={`secondary-card ${styles.section}`} aria-labelledby="school-community-title">
    <h2 id="school-community-title">Your school community</h2>
    <p className="secondary-muted">Reconnect with registered alumni. Showing 10 people per page, newest members first.</p>
    <div className={styles.tabs} aria-label="Community list">
      {(['classmates', 'schoolmates'] as const).map(value => <button key={value} aria-pressed={mode === value} disabled={saving} onClick={() => { setMode(value); setPage(1); setEditing(false); setSaveError(''); }}>{value === 'classmates' ? 'Classmates' : 'Schoolmates'}</button>)}
    </div>
    <p className="secondary-muted">{mode === 'classmates' ? 'Same school, same recorded grade and year. Matches are based on the details members provide.' : 'All other registered alumni of this school, across grades and years.'}</p>
    {loading && <p role="status">Finding your {mode}…</p>}
    {error && <div role="alert"><p>{error}</p>{accessStatus === 401 ? <a href="/">Sign in</a> : accessStatus === 403 ? <a href="/schools">Find and add your school</a> : <button onClick={() => setRefresh(n => n + 1)}>Try again</button>}</div>}
    {notice && <p role="status">{notice}</p>}
    {result && <>
      <div className={styles.cohort}><span>{result.cohort.grade && result.cohort.year ? `Your details: Grade ${result.cohort.grade} in ${result.cohort.year}` : 'Add the grade and year you left to find classmates.'}</span><button onClick={() => { setEditing(!editing); setSaveError(''); }} disabled={saving}>{editing ? 'Close' : 'Edit my school details'}</button></div>
      {(editing || result.needsDetails) && <form onSubmit={save} className={styles.form}>
        <label>Grade when you left<select required value={grade} onChange={e => setGrade(e.target.value)} disabled={saving}><option value="">Choose grade</option>{Array.from({ length: 12 }, (_, i) => i + 1).map(g => <option key={g} value={g}>Grade {g}</option>)}</select></label>
        <label>Year you left<input required type="number" min={1900} max={new Date().getFullYear()} placeholder="e.g. 2007" value={year} onChange={e => setYear(e.target.value)} disabled={saving}/></label>
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save and find classmates'}</button>
        {saveError && <p role="alert">{saveError}</p>}
      </form>}
      {!result.needsDetails && <>
        <p role="status">{result.total ? `${result.total} ${mode} · Showing ${(page - 1) * 10 + 1}–${Math.min(page * 10, result.total)}` : `No ${mode} registered yet. Check again as more alumni join.`}</p>
        <ol className={styles.list} start={(page - 1) * 10 + 1}>{result.items.map(person => <li key={person.id}><b>{person.name}</b><span>{person.grade ? `Grade ${person.grade}` : 'Grade not added'} · {person.year || 'Year not added'}</span></li>)}</ol>
        {pages > 1 && <nav className={styles.pagination} aria-label="Community pages"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button></nav>}
      </>}
    </>}
  </section>;
}
