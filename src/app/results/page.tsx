'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowLeftRight, Bookmark, Check, CheckCircle2, Copy, Download, Files, FlaskConical, Layers3, Loader2, Table2 } from 'lucide-react';
import { withBasePath } from '@/lib/base-path';
import { buildJobBookmark, expiresAt, readJobBookmark, type JobBookmark } from '@/lib/job-bookmark';

type ResultValue = string | number | boolean | null;
type ResultRow = Record<string, ResultValue>;
type StoredResults = {
  jobId?: string;
  status?: 'queued' | 'running' | 'completed' | 'failed';
  message?: string;
  error?: string;
  createdAt?: string;
  updatedAt?: string;
  results?: Record<string, ResultRow[]>;
};

async function fetchJob(job: JobBookmark) {
  const response = await fetch(withBasePath(`/api/predict?jobId=${encodeURIComponent(job.jobId)}`), { cache: 'no-store', headers: { 'X-LegumeLoc-Job-Token': job.jobToken } });
  const raw = await response.text();
  let result: StoredResults;
  try { result = JSON.parse(raw) as StoredResults; } catch { throw new Error(`The prediction service returned ${response.status} ${response.statusText}.`); }
  if (!response.ok) throw new Error(result.error || 'This saved result could not be found.');
  return result;
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const levelMeta = (fileName: string) => {
  if (fileName.includes('single_vs_dual')) return { level: 'Level I', title: 'Single vs dual localization', note: 'Primary localization mode' };
  if (fileName.includes('single_class')) return { level: 'Level II', title: 'Single-localization class', note: '11 cellular compartments' };
  if (fileName.includes('dual_class')) return { level: 'Level III', title: 'Dual-localization class', note: '14 compartment pairs' };
  return { level: 'Result', title: fileName, note: 'Prediction output' };
};

const levelRank = (fileName: string) => {
  if (fileName.includes('single_vs_dual')) return 1;
  if (fileName.includes('single_class')) return 2;
  if (fileName.includes('dual_class')) return 3;
  return 99;
};

const sortByLevel = (files: string[]) => [...files].sort((a, b) => levelRank(a) - levelRank(b));

const rowsToTsv = (rows: ResultRow[]) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return [headers.join('\t'), ...rows.map((row) => headers.map((header) => String(row[header] ?? '')).join('\t'))].join('\n');
};

const saveTextFile = (content: string, fileName: string) => {
  const blob = new Blob([content], { type: 'text/tab-separated-values;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function ResultsPage() {
  const [data, setData] = useState<StoredResults | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeLevel, setActiveLevel] = useState('');
  const [loadMessage, setLoadMessage] = useState('Opening your saved analysis…');
  const [loadError, setLoadError] = useState('');
  const [bookmark, setBookmark] = useState<JobBookmark | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const savedJob = readJobBookmark();
      if (!savedJob) {
        const saved = localStorage.getItem('legumeloc_last_results');
        if (saved) try {
          const parsed = JSON.parse(saved) as StoredResults;
          setData(parsed);
          setActiveLevel(sortByLevel(Object.keys(parsed.results || {}))[0] || '');
        } catch (error: unknown) { console.error('Unable to read stored LegumeLoc results.', error); }
        setLoaded(true);
        return;
      }
      setBookmark(savedJob);
      void (async () => {
        try {
          let result = await fetchJob(savedJob);
          while (!cancelled && (result.status === 'queued' || result.status === 'running')) {
            setLoadMessage(result.message || 'Prediction is still running…');
            await wait(3000);
            result = await fetchJob(savedJob);
          }
          if (cancelled) return;
          if (result.status === 'failed') throw new Error(result.error || 'Prediction failed.');
          localStorage.setItem('legumeloc_last_results', JSON.stringify(result));
          setData(result);
          setActiveLevel(sortByLevel(Object.keys(result.results || {}))[0] || '');
        } catch (error: unknown) {
          if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to open the saved result.');
        } finally {
          if (!cancelled) setLoaded(true);
        }
      })();
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);

  const resultFiles = useMemo(() => sortByLevel(Object.keys(data?.results || {})), [data]);
  const activeRows = data?.results?.[activeLevel] || [];
  const totalRows = useMemo(() => Math.max(0, ...resultFiles.map((file) => data?.results?.[file]?.length || 0)), [data, resultFiles]);
  const resultBookmarkUrl = bookmark ? buildJobBookmark(bookmark) : '';
  const expiryDate = data?.updatedAt ? expiresAt(data.updatedAt) : null;

  const downloadActive = () => {
    if (activeRows.length) saveTextFile(rowsToTsv(activeRows), activeLevel || 'LegumeLoc_results.txt');
  };

  const downloadAll = () => {
    const content = resultFiles
      .map((file) => `# ${levelMeta(file).level}: ${levelMeta(file).title}\n${rowsToTsv(data?.results?.[file] || [])}`)
      .join('\n\n');
    if (content) saveTextFile(content, 'LegumeLoc_all_levels.txt');
  };

  if (!loaded) {
    return <div className="container mx-auto max-w-3xl py-16" aria-live="polite"><div className="rounded-lg border border-[#d8e0e6] bg-[#fafafa] px-6 py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#1c7e9c]" /><h1 className="mt-5 font-sans text-2xl font-semibold text-[#24282c]">Loading prediction results</h1><p className="mt-2 text-sm text-slate-600">{loadMessage}</p></div></div>;
  }

  if (!data || resultFiles.length === 0) {
    return (
      <div className="container mx-auto max-w-5xl py-10 sm:py-16">
        <section className="relative overflow-hidden rounded-lg border border-[#d8e0e6] bg-[#fafafa] px-6 py-16 text-center sm:px-12">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border-[38px] border-[#E8DFC9]" />
          <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-[#1c7e9c] shadow-sm"><FlaskConical className="h-6 w-6" /></span>
          <p className="relative mt-6 text-[11px] font-black uppercase tracking-[0.2em] text-[#1c7e9c]">Results workspace</p>
          <h1 className="relative mt-2 font-sans text-4xl font-semibold text-[#24282c]">No prediction results yet</h1>
          <p className="relative mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600">{loadError || 'Submit legume protein sequences on the Prediction page. Completed results remain available through their private link for 30 days.'}</p>
          <Link href="/prediction" className="relative mt-7 inline-flex items-center gap-2 rounded-full bg-[#1c7e9c] px-6 py-3 text-sm font-bold text-white shadow-[0_10px_25px_rgba(47,95,120,0.2)]"><FlaskConical className="h-4 w-4" /> Start a prediction</Link>
        </section>
      </div>
    );
  }

  const activeMeta = levelMeta(activeLevel);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 py-5 sm:py-8">
      <header className="relative overflow-hidden rounded-lg bg-[#24282c] px-6 py-8 text-white sm:px-9">
        <div className="pointer-events-none absolute -right-10 -top-28 h-72 w-72 rounded-full border-[46px] border-white/5" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#d8c79d]"><CheckCircle2 className="h-4 w-4" /> Analysis complete</div>
            <h1 className="mt-3 font-sans text-4xl font-semibold tracking-tight sm:text-5xl">LegumeLoc results</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Review each requested prediction level, inspect the tabular output, or export the complete analysis.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/prediction" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10"><ArrowLeft className="h-4 w-4" /> New prediction</Link>
            <button type="button" onClick={downloadAll} className="inline-flex items-center gap-2 rounded-full bg-[#7a858c] px-5 py-2.5 text-xs font-black text-[#24282c] transition hover:bg-[#D9AA4A]"><Files className="h-4 w-4" /> Download all levels</button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Run summary">
        <div className="rounded-lg border border-slate-200 bg-white p-5"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Sequences</p><p className="mt-2 font-sans text-3xl font-semibold text-[#24282c]">{totalRows}</p><p className="mt-1 text-xs text-slate-500">Protein records analyzed</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-5"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Outputs</p><p className="mt-2 font-sans text-3xl font-semibold text-[#24282c]">{resultFiles.length}</p><p className="mt-1 text-xs text-slate-500">Prediction levels available</p></div>
        <div className="min-w-0 rounded-lg border border-[#D9E4E7] bg-[#eef2f3] p-5"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1c7e9c]">Results ID</p><p className="mt-2 truncate font-mono text-sm font-bold text-[#24282c]" title={data.jobId}>{data.jobId || 'Browser result'}</p><p className="mt-2 text-xs text-slate-600">{expiryDate ? `Available until ${expiryDate.toLocaleDateString()}` : 'Save the private URL below'}</p></div>
      </section>

      {bookmark && <section className="rounded-lg border border-[#D9E4E7] bg-[#F7FAFA] p-4 sm:flex sm:items-center sm:gap-4" aria-label="Saved results link"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#1c7e9c]"><Bookmark className="h-4 w-4" /></span><div className="mt-3 min-w-0 flex-1 sm:mt-0"><p className="text-xs font-bold text-[#24282c]">Bookmark this private results link</p><p className="mt-1 truncate font-mono text-[10px] text-slate-500" title={resultBookmarkUrl}>{resultBookmarkUrl}</p><p className="mt-1 text-[10px] text-slate-500">Anyone with this link can view the result until it expires. Do not share it publicly.</p></div><button type="button" onClick={() => void navigator.clipboard.writeText(resultBookmarkUrl).then(() => { setLinkCopied(true); window.setTimeout(() => setLinkCopied(false), 1800); })} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#24282c] px-4 py-2.5 text-xs font-bold text-white sm:mt-0">{linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{linkCopied ? 'Copied' : 'Copy link'}</button></section>}

      <div className="space-y-4">
        <nav className="rounded-lg border border-slate-200 bg-[#fafafa] p-3" aria-label="Prediction levels">
          <div className="flex flex-col gap-3 px-2 pb-2 pt-1 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1c7e9c]">Output navigator</p><h2 className="mt-1 font-sans text-xl font-semibold text-[#24282c]">Prediction levels</h2></div><p className="text-[11px] text-slate-500">Choose a level to update the table below.</p></div>
          <div className="grid gap-2 sm:grid-cols-3">
            {resultFiles.map((fileName) => {
              const meta = levelMeta(fileName);
              const isActive = activeLevel === fileName;
              return <button key={fileName} type="button" onClick={() => setActiveLevel(fileName)} className={`w-full rounded-md border p-3 text-left transition ${isActive ? 'border-[#1c7e9c] bg-[#1c7e9c] text-white shadow-sm' : 'border-transparent bg-white text-slate-700 hover:border-[#C4D5DB]'}`}><span className={`text-[10px] font-black uppercase tracking-[0.15em] ${isActive ? 'text-[#EBD08A]' : 'text-[#1c7e9c]'}`}>{meta.level}</span><span className="mt-1 block text-sm font-bold leading-5">{meta.title}</span><span className={`mt-1 block text-[11px] ${isActive ? 'text-slate-200' : 'text-slate-500'}`}>{meta.note}</span></button>;
            })}
          </div>
        </nav>

        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_50px_rgba(23,47,66,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1c7e9c]">{activeMeta.level}</p><h2 className="mt-1 font-sans text-2xl font-semibold text-[#24282c]">{activeMeta.title}</h2><p className="mt-1 text-xs text-slate-500">{activeRows.length} result row{activeRows.length === 1 ? '' : 's'}</p></div>
            <button type="button" onClick={downloadActive} disabled={!activeRows.length} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#1c7e9c] px-4 py-2.5 text-xs font-bold text-[#1c7e9c] transition hover:bg-[#eef2f3] disabled:opacity-40"><Download className="h-4 w-4" /> Download this level</button>
          </div>

          <div className="flex items-center justify-end gap-1.5 border-b border-slate-100 bg-slate-50 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500"><ArrowLeftRight className="h-3.5 w-3.5" /> Scroll horizontally to view all columns</div>
          <div className="results-table-scroll overflow-x-scroll">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-[#eef2f3] text-[#24282c]">
                <tr>{activeRows.length > 0 && Object.keys(activeRows[0]).map((header) => <th key={header} className="border-b border-[#D5E1E5] px-5 py-3.5 font-black uppercase tracking-[0.08em]">{header}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {activeRows.map((row, rowIndex) => <tr key={rowIndex} className="transition hover:bg-[#FDFBF6]">{Object.entries(row).map(([key, value]) => <td key={key} className="whitespace-nowrap px-5 py-3.5 text-slate-700">{key.toLowerCase().includes('prediction') ? <span className="rounded-full border border-[#C1D4DB] bg-[#eef2f3] px-2.5 py-1 font-sans font-bold text-[#1c7e9c]">{String(value ?? '')}</span> : <span>{String(value ?? '')}</span>}</td>)}</tr>)}
                {!activeRows.length && <tr><td colSpan={10} className="px-5 py-16 text-center"><Table2 className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-sans text-sm font-bold text-slate-700">No rows returned for this level</p></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 text-[11px] text-slate-500"><Layers3 className="h-3.5 w-3.5" /> Values are shown exactly as returned by the prediction service.</div>
        </section>
      </div>
    </div>
  );
}
