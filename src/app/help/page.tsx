import Link from 'next/link';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  CircleAlert,
  Database,
  Download,
  FileText,
  Gauge,
  Layers3,
  LockKeyhole,
  Play,
  Table2,
  Upload,
} from 'lucide-react';

const topics = [
  ['quick-start', '01', 'Quick start'],
  ['input', '02', 'Prepare input'],
  ['levels', '03', 'Prediction levels'],
  ['strategy', '04', 'Model strategy'],
  ['submit', '05', 'Submit and monitor'],
  ['results', '06', 'Results and downloads'],
  ['troubleshooting', '07', 'Troubleshooting'],
  ['limits', '08', 'Limits and privacy'],
];

const inputMethods = [
  { icon: FileText, title: 'Paste FASTA', copy: 'Paste one or more protein records directly. Every record needs a non-empty header beginning with > and a sequence on the following line.' },
  { icon: Upload, title: 'Upload a file', copy: 'Upload .fasta, .fa, .txt, .csv, or .tsv. FASTA is loaded directly; a plain accession list is fetched using the selected database.' },
  { icon: Database, title: 'Use accessions', copy: 'Enter NCBI Protein or UniProt accessions separated by commas, spaces, semicolons, or new lines. Up to 50 can be fetched at once.' },
];

const levels = [
  ['I', 'Single vs dual', 'Routes each protein to single or dual localization.'],
  ['II', 'Single localization', 'Assigns a single-localized protein to one of 11 supported compartments.'],
  ['III', 'Dual localization', 'Assigns a dual-localized protein to one of 14 supported compartment pairs.'],
];

const troubleshooting = [
  ['“FASTA input must begin with a > header.”', 'Add a header line before every protein sequence, for example >protein_1. Do not place sequence characters before the first header.'],
  ['“FASTA contains invalid amino-acid characters.”', 'Remove numbers, punctuation, gaps, and nucleotide-only formatting. The server accepts standard amino-acid symbols plus B, X, Z, J, U, O, and * only.'],
  ['An accession cannot be fetched.', 'Confirm that the identifier belongs to the selected source—NCBI Protein or UniProt—and remove version or punctuation errors. You can paste FASTA instead if the record is unavailable remotely.'],
  ['The job appears to remain queued or running.', 'Keep the page open or save the private results link. The browser checks status every few seconds and resumes monitoring a locally remembered active job after a refresh.'],
  ['The private results link no longer works.', 'Check that the complete URL, including its private token, was copied. Results are retained for 30 days by default and cannot be restored after expiry.'],
];

export default function HelpPage() {
  return (
    <div className="container mx-auto max-w-7xl pb-16 pt-6 sm:pt-10">
      <header className="grid gap-8 border-y border-[#c3cfd8] py-10 lg:grid-cols-[1fr_330px] lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#1c7e9c]"><BookOpen className="h-4 w-4" /> LegumeLoc user guide</p>
          <h1 className="mt-4 max-w-3xl font-sans text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-[#24282c] sm:text-6xl">LegumeLoc web-server guide</h1>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-[#667581]">A complete guide to accepted protein input, model configuration, private job links, output files, and common errors.</p>
        </div>
        <div className="border border-[#ccd4cd] bg-white p-5">
          <p className="text-xs font-bold text-[#2c3943]">Need direct assistance?</p>
          <p className="mt-2 text-xs leading-5 text-[#6b7882]">LegumeLoc is free to use and does not require an account.</p>
          <a href="mailto:rkaundal@usu.edu" className="mt-3 block text-xs font-bold text-[#315e7d] hover:underline">rkaundal@usu.edu</a>
          <Link href="/prediction" className="mt-5 flex items-center justify-between bg-[#1c7e9c] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#14657c]">Open prediction workspace <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </header>

      <div className="pt-10">
        <aside className="mb-12 border-b border-[#cfd4dc] pb-5">
          <p className="border-b border-[#c7cfc8] pb-3 text-[10px] font-black uppercase tracking-[0.15em] text-[#1c7e9c]">Guide contents</p>
          <nav aria-label="Help topics">
            {topics.map(([href, number, label]) => (
              <a key={href} href={`#${href}`} className="group mr-5 inline-flex gap-2 py-2 text-xs font-semibold text-[#606a62] transition hover:text-[#1c7e9c]">
                <span className="font-mono text-[9px] text-[#8a938b]">{number}</span><span>{label}</span>
              </a>
            ))}
          </nav>
          <div className="mt-4 border-l-2 border-[#1c7e9c] pl-4 text-[11px] leading-5 text-[#6b7882]">Use protein sequences only. LegumeLoc does not accept nucleotide FASTA.</div>
        </aside>

        <article className="mx-auto min-w-0 max-w-5xl space-y-16">
          <section id="quick-start" className="scroll-mt-24" aria-labelledby="quick-start-title">
            <p className="section-kicker">01 / Quick start</p>
            <h2 id="quick-start-title" className="help-title">A prediction in four steps</h2>
            <ol className="mt-7 grid border border-[#cdd7df] bg-[#cdd7df] sm:grid-cols-2 sm:gap-px lg:grid-cols-4">
              {[
                ['1', 'Choose input', 'Select pasted FASTA, file upload, or NCBI/UniProt accessions.'],
                ['2', 'Add sequences', 'Enter, upload, or retrieve the protein records to be analyzed.'],
                ['3', 'Choose results', 'Select the classification depth and Fast or Sensitive model.'],
                ['4', 'Submit and save', 'Start the job, retain its private link, and download completed results.'],
              ].map(([number, title, copy]) => (
                <li key={number} className="bg-white p-5"><span className="font-sans text-3xl text-[#1c7e9c]">{number}</span><h3 className="mt-4 text-sm font-bold text-[#24282c]">{title}</h3><p className="mt-2 text-xs leading-5 text-[#6b7882]">{copy}</p></li>
              ))}
            </ol>
          </section>

          <section id="input" className="scroll-mt-24" aria-labelledby="input-title">
            <p className="section-kicker">02 / Prepare input</p>
            <h2 id="input-title" className="help-title">Three supported input routes</h2>
            <p className="help-intro">Whichever route you choose, the prediction server ultimately validates and submits protein FASTA. Fetched sequences are shown in an editable preview before the job begins.</p>
            <div className="mt-7 divide-y divide-[#d1d7d1] border-y border-[#d1d7d1]">
              {inputMethods.map(({ icon: Icon, title, copy }) => (
                <div key={title} className="grid gap-3 py-5 sm:grid-cols-[44px_150px_1fr] sm:items-start"><span className="grid h-9 w-9 place-items-center bg-[#edf2f5] text-[#315e7d]"><Icon className="h-4 w-4" /></span><h3 className="text-sm font-bold text-[#24282c]">{title}</h3><p className="text-xs leading-5 text-[#6b7882]">{copy}</p></div>
              ))}
            </div>
            <div className="mt-7 grid gap-px border border-[#cdd7df] bg-[#cdd7df] md:grid-cols-[1fr_1fr]">
              <div className="bg-[#24282c] p-5 text-white"><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#c8ced8]">Valid legume example</p><pre className="mt-4 overflow-x-auto font-mono text-xs leading-6 text-[#eef2f3]">{`>A0A444WUS4\nMGQCASRRTNNNNNNNGGISGGGGYVHSER...\n>A0A191UJB7\nMSHSVKIYDTCIGCTQCVRACPTDVLEMIP...`}</pre></div>
              <div className="bg-[#f7f9fa] p-5"><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#6b7882]">Validation checklist</p><ul className="mt-4 space-y-2 text-xs leading-5 text-[#5f6e79]"><li>✓ Non-empty header after each &gt;</li><li>✓ At least one amino-acid residue per record</li><li>✓ No numbers, gap characters, or punctuation in sequences</li><li>✓ Protein rather than nucleotide input</li></ul></div>
            </div>
          </section>

          <section id="levels" className="scroll-mt-24" aria-labelledby="levels-title">
            <p className="section-kicker">03 / Prediction levels</p>
            <h2 id="levels-title" className="help-title">Choose the required classification depth</h2>
            <p className="help-intro">The selected level is passed to the LegumeLoc command-line model. Higher levels request the corresponding downstream classification defined by the hierarchy.</p>
            <div className="mt-7 border-t border-[#bac6cf]">{levels.map(([number, title, copy]) => <div key={number} className="grid gap-2 border-b border-[#bac6cf] py-5 sm:grid-cols-[90px_190px_1fr]"><span className="font-mono text-xs font-bold text-[#1c7e9c]">LEVEL {number}</span><h3 className="text-sm font-bold text-[#24282c]">{title}</h3><p className="text-xs leading-5 text-[#6b7882]">{copy}</p></div>)}</div>
          </section>

          <section id="strategy" className="scroll-mt-24" aria-labelledby="strategy-title">
            <p className="section-kicker">04 / Model strategy</p>
            <h2 id="strategy-title" className="help-title">Fast or Sensitive</h2>
            <div className="mt-7 grid gap-px border border-[#cdd7df] bg-[#cdd7df] sm:grid-cols-2">
              <div className="bg-white p-6"><Gauge className="h-5 w-5 text-[#315e7d]" /><h3 className="mt-5 font-sans text-2xl font-semibold text-[#24282c]">Fast</h3><p className="mt-3 text-xs leading-5 text-[#6b7882]">Uses dipeptide amino-acid composition features. Choose it for larger batches or when shorter turnaround is the priority.</p><p className="mt-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[#1c7e9c]">DPCP feature vector</p></div>
              <div className="bg-white p-6"><Layers3 className="h-5 w-5 text-[#7a858c]" /><h3 className="mt-5 font-sans text-2xl font-semibold text-[#24282c]">Sensitive</h3><p className="mt-3 text-xs leading-5 text-[#6b7882]">Uses tripeptide amino-acid composition features. Choose it for smaller batches when prediction sensitivity is the priority.</p><p className="mt-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[#7a858c]">TPC feature vector</p></div>
            </div>
          </section>

          <section id="submit" className="scroll-mt-24" aria-labelledby="submit-title">
            <p className="section-kicker">05 / Submit and monitor</p>
            <h2 id="submit-title" className="help-title">Keep the private job link</h2>
            <p className="help-intro">Choose Run Prediction after checking the input, level, and model. If anti-bot verification is enabled on the deployment, complete it before submission.</p>
            <div className="mt-7 grid gap-5 sm:grid-cols-3">
              {[['Queued', 'The server accepted the input and is waiting for execution.'], ['Running', 'The job is being processed; status is checked every three seconds.'], ['Completed', 'The browser opens Results automatically and the output becomes downloadable.']].map(([title, copy], index) => <div key={title} className="border-t-2 border-[#1c7e9c] pt-4"><span className="font-mono text-[9px] text-[#7a8791]">0{index + 1}</span><h3 className="mt-2 text-sm font-bold text-[#24282c]">{title}</h3><p className="mt-2 text-xs leading-5 text-[#6b7882]">{copy}</p></div>)}
            </div>
            <p className="mt-7 flex gap-3 border border-[#d5dcd5] bg-[#f0f3ef] p-4 text-xs leading-5 text-[#4f5a52]"><Bookmark className="mt-0.5 h-4 w-4 shrink-0 text-[#315e7d]" /><span>Copy the results URL shown after submission. It contains a private token, can resume job monitoring, and should not be shared publicly.</span></p>
          </section>

          <section id="results" className="scroll-mt-24" aria-labelledby="results-title">
            <p className="section-kicker">06 / Results and downloads</p>
            <h2 id="results-title" className="help-title">Read each available output level</h2>
            <p className="help-intro">The Results workspace presents available Level I–III outputs above a horizontally scrollable table. Column names come directly from the predictor output.</p>
            <div className="mt-7 grid gap-px border border-[#cdd7df] bg-[#cdd7df] sm:grid-cols-2"><div className="bg-white p-5"><Table2 className="h-5 w-5 text-[#315e7d]" /><h3 className="mt-4 text-sm font-bold text-[#24282c]">Inspect in the browser</h3><p className="mt-2 text-xs leading-5 text-[#6b7882]">Switch among available result levels and scroll wide tables horizontally without truncating columns.</p></div><div className="bg-white p-5"><Download className="h-5 w-5 text-[#315e7d]" /><h3 className="mt-4 text-sm font-bold text-[#24282c]">Export results</h3><p className="mt-2 text-xs leading-5 text-[#6b7882]">Download an individual level or export all available output files together for downstream analysis.</p></div></div>
          </section>

          <section id="troubleshooting" className="scroll-mt-24" aria-labelledby="troubleshooting-title">
            <p className="section-kicker">07 / Troubleshooting</p>
            <h2 id="troubleshooting-title" className="help-title">Common problems</h2>
            <div className="mt-7 border-t border-[#bdc9d2]">{troubleshooting.map(([problem, answer]) => <details key={problem} className="group border-b border-[#bdc9d2] py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-[#2b3b47]"><span>{problem}</span><span className="text-lg font-normal text-[#1c7e9c] transition group-open:rotate-45">+</span></summary><p className="max-w-3xl pb-2 pt-4 text-xs leading-5 text-[#6b7882]">{answer}</p></details>)}</div>
          </section>

          <section id="limits" className="scroll-mt-24" aria-labelledby="limits-title">
            <p className="section-kicker">08 / Limits and privacy</p>
            <h2 id="limits-title" className="help-title">Current server boundaries</h2>
            <div className="mt-7 overflow-x-auto border border-[#cdd7df]"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-[#e8eef2] text-[#2c3943]"><tr><th className="px-4 py-3 font-bold">Constraint</th><th className="px-4 py-3 font-bold">Default</th><th className="px-4 py-3 font-bold">What it means</th></tr></thead><tbody className="divide-y divide-[#dce4e9] bg-white text-[#667581]"><tr><td className="px-4 py-3 font-semibold text-[#2c3943]">Sequences per job</td><td className="px-4 py-3">10,000</td><td className="px-4 py-3">The deployment can override this value.</td></tr><tr><td className="px-4 py-3 font-semibold text-[#2c3943]">Sequence length</td><td className="px-4 py-3">20,000 residues</td><td className="px-4 py-3">Maximum for any individual record.</td></tr><tr><td className="px-4 py-3 font-semibold text-[#2c3943]">Total residues</td><td className="px-4 py-3">1,000,000</td><td className="px-4 py-3">Maximum combined length of one submitted job.</td></tr><tr><td className="px-4 py-3 font-semibold text-[#2c3943]">Accession fetch</td><td className="px-4 py-3">50 IDs</td><td className="px-4 py-3">Maximum fetched from NCBI or UniProt at once.</td></tr><tr><td className="px-4 py-3 font-semibold text-[#2c3943]">Result retention</td><td className="px-4 py-3">30 days</td><td className="px-4 py-3">Keep a local download for long-term storage.</td></tr></tbody></table></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2"><p className="flex gap-3 border-l-2 border-[#1c7e9c] pl-4 text-xs leading-5 text-[#667581]"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /> Job results require the unguessable token embedded in the private link.</p><p className="flex gap-3 border-l-2 border-[#7a858c] pl-4 text-xs leading-5 text-[#667581]"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> Do not submit confidential or personally identifying information in FASTA headers.</p></div>
          </section>

          <div className="flex flex-col items-start justify-between gap-5 border-t border-[#c3cfd8] pt-8 sm:flex-row sm:items-center"><div><p className="text-sm font-bold text-[#24282c]">Ready to begin?</p><p className="mt-1 text-xs text-[#6b7882]">Open the workspace and load the included demonstration sequences.</p></div><Link href="/prediction" className="inline-flex items-center gap-2 bg-[#1c7e9c] px-5 py-3 text-xs font-bold text-white hover:bg-[#14657c]">Open prediction <Play className="h-3.5 w-3.5" /></Link></div>
        </article>
      </div>
    </div>
  );
}
