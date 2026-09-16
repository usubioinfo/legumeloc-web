import Link from 'next/link';
import { withBasePath } from '@/lib/base-path';
import { ArrowRight, CloudDownload, FileInput, Gauge, Layers3, Mail, PackageCheck, ShieldCheck, SquareTerminal } from 'lucide-react';

const installCommand = `# 1. Extract the package
tar -xvzf LegumeLoc.tar.gz
cd LegumeLoc

# 2. Create the recommended conda environment
conda env create -f environment.yml
conda activate LegumeLoc

# 3. Install LegumeLoc
pip3 install .`;

const systemPythonCommand = `tar -xvzf LegumeLoc.tar.gz
cd LegumeLoc
pip3 install .`;

export default function DownloadPage() {
  return (
    <div className="container mx-auto max-w-7xl space-y-6 py-5 sm:py-8">
      <header className="relative overflow-hidden rounded-lg bg-[#2B2D42] px-6 py-9 text-white sm:px-10 sm:py-11">
        <div className="relative grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#d8c79d]"><PackageCheck className="h-4 w-4" /> Standalone command-line package</p>
            <h1 className="mt-3 font-sans text-4xl font-semibold tracking-tight sm:text-5xl">Run LegumeLoc locally</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">Download the legume protein localization models, Python utilities, and example inputs for reproducible local analysis.</p>
          </div>
          <a href={withBasePath('/download/LegumeLoc.tar.gz')} download className="group rounded bg-[#EF233C] p-5 text-white transition hover:bg-[#D90429]">
            <span className="flex items-center justify-between"><CloudDownload className="h-6 w-6" /><ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" /></span>
            <span className="mt-5 block font-sans text-xl font-semibold">Download package</span><span className="mt-1 block text-xs font-bold">LegumeLoc.tar.gz</span>
          </a>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Package summary">
        <div className="rounded-lg border border-slate-200 bg-white p-5"><FileInput className="h-5 w-5 text-[#D90429]" /><h2 className="mt-4 font-sans text-xl font-semibold text-[#2B2D42]">Protein FASTA</h2><p className="mt-2 text-xs leading-5 text-slate-600">Accepts one or more amino-acid sequences. Nucleotide sequences are not supported.</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-5"><Gauge className="h-5 w-5 text-[#8A5B12]" /><h2 className="mt-4 font-sans text-xl font-semibold text-[#2B2D42]">Two strategies</h2><p className="mt-2 text-xs leading-5 text-slate-600">Choose Fast dipeptide features or Sensitive tripeptide features.</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-5"><ShieldCheck className="h-5 w-5 text-[#8D99AE]" /><h2 className="mt-4 font-sans text-xl font-semibold text-[#2B2D42]">Research software</h2><p className="mt-2 text-xs leading-5 text-slate-600">Download the standalone package for local research use. Reuse rights remain reserved unless a license is added.</p></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-6">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#EDF2F4] text-[#D90429]"><SquareTerminal className="h-4 w-4" /></span><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D90429]">Recommended setup</p><h2 className="font-sans text-2xl font-semibold text-[#2B2D42]">Install with conda</h2></div></div>
            <pre className="overflow-x-auto bg-[#102432] p-6 font-mono text-xs leading-6 text-[#EDF2F4]"><code>{installCommand}</code></pre>
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-5"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Alternative setup</p><h2 className="mt-1 font-sans text-2xl font-semibold text-[#2B2D42]">Install with system Python 3</h2><p className="mt-2 text-xs leading-5 text-slate-600">Use this route only when the required dependencies are already available in your Python environment.</p></div>
            <pre className="overflow-x-auto bg-[#F6F3EB] p-6 font-mono text-xs leading-6 text-slate-700"><code>{systemPythonCommand}</code></pre>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D90429]">Example command</p><h2 className="mt-1 font-sans text-2xl font-semibold text-[#2B2D42]">Run a prediction</h2>
            <pre className="mt-5 overflow-x-auto rounded-md bg-[#2B2D42] p-5 font-mono text-xs leading-6 text-[#EDF2F4]"><code>python LegumeLoc.py -i ./example/test.fasta -o output -l level3 -m fast</code></pre>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">{[['-i', 'Input FASTA file'], ['-o', 'Output directory'], ['-l', 'Highest prediction level'], ['-m', 'fast or sensitive strategy']].map(([flag, meaning]) => <div key={flag} className="flex gap-3 rounded-md bg-[#F8F9FA] p-3"><code className="font-bold text-[#D90429]">{flag}</code><span className="text-xs text-slate-600">{meaning}</span></div>)}</div>
          </section>
        </main>

        <aside className="space-y-4 self-start lg:sticky lg:top-24">
          <section className="rounded-lg border border-[#cfd4dc] bg-[#EDF2F4] p-5"><Layers3 className="h-5 w-5 text-[#D90429]" /><h2 className="mt-4 font-sans text-xl font-semibold text-[#2B2D42]">Three output levels</h2><ol className="mt-4 space-y-3 text-xs text-slate-600"><li><strong className="text-[#2B2D42]">Level I</strong> · Single vs dual</li><li><strong className="text-[#2B2D42]">Level II</strong> · 11 single-localization classes</li><li><strong className="text-[#2B2D42]">Level III</strong> · 14 dual-localization classes</li></ol></section>
          <section className="rounded-lg border border-slate-200 bg-white p-5"><Mail className="h-5 w-5 text-[#8D99AE]" /><h2 className="mt-4 font-sans text-xl font-semibold text-[#2B2D42]">Questions</h2><p className="mt-2 text-xs leading-5 text-slate-600">Kaundal Bioinformatics Lab<br />Utah State University</p><div className="mt-4 space-y-2 text-xs"><a className="block font-bold text-[#D90429] hover:underline" href="mailto:naveen.duhan@usu.edu">naveen.duhan@usu.edu</a><a className="block font-bold text-[#D90429] hover:underline" href="mailto:rkaundal@usu.edu">rkaundal@usu.edu</a></div></section>
          <Link href="/help" className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-4 text-xs font-bold text-[#2B2D42] transition hover:border-[#D90429]">Read the web-server guide <ArrowRight className="h-4 w-4 text-[#D90429]" /></Link>
        </aside>
      </div>
    </div>
  );
}
