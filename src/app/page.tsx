import Link from 'next/link';
import { ArrowRight, BookOpen, Download, Layers3 } from 'lucide-react';

const levels = [
  ['Level I', 'Single vs dual', 'Classifies each submitted protein as single- or dual-localized.'],
  ['Level II', 'Single localization', 'Assigns single-localized proteins to one of 11 supported classes.'],
  ['Level III', 'Dual localization', 'Assigns dual-localized proteins to one of 14 supported class pairs.'],
];

export default function Home() {
  return (
    <div className="space-y-14 pb-16 pt-8 sm:pt-12">
      <section className="border-y-2 border-[#2B2D42] bg-white" aria-labelledby="hero-title">
        <div className="grid lg:grid-cols-[.42fr_1fr]">
          <aside className="border-b border-[#cfd4dc] bg-[#EDF2F4] p-7 lg:border-b-0 lg:border-r lg:p-9" aria-label="LegumeLoc overview">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#D90429]">Web prediction server</p>
            <h2 className="mt-5 text-base font-semibold text-[#2B2D42]">Designed for legume proteins</h2>
            <p className="mt-3 text-sm leading-6 text-[#5e6674]">Sequence-based classification of single and dual subcellular localization.</p>
            <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden border border-[#c5ccd6] bg-[#c5ccd6]">
              {[['3', 'output levels'], ['11', 'single classes'], ['14', 'dual pairs'], ['10,000', 'sequences']].map(([value, label]) => (
                <div key={label} className="bg-white px-4 py-4">
                  <dd className="text-xl font-bold text-[#2B2D42]">{value}</dd>
                  <dt className="mt-1 text-xs leading-4 text-[#5e6674]">{label}</dt>
                </div>
              ))}
            </dl>
          </aside>

          <div className="flex flex-col justify-center p-7 sm:p-11 lg:min-h-[430px] lg:p-14">
            <p className="text-sm font-semibold text-[#D90429]">LegumeLoc</p>
            <h1 id="hero-title" className="mt-3 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-[-.04em] text-[#2B2D42] sm:text-5xl lg:text-6xl">Protein localization prediction for legume research</h1>
            <p className="mt-6 max-w-2xl border-l-4 border-[#8D99AE] pl-5 text-base leading-7 text-[#5e6674]">Submit amino-acid sequences to obtain hierarchical predictions from deep-learning models, with results organized for review and export.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/prediction" className="inline-flex items-center gap-2 rounded bg-[#EF233C] px-5 py-3 text-sm font-bold text-white hover:bg-[#D90429]">Start an analysis <ArrowRight className="h-4 w-4"/></Link>
              <Link href="/help" className="inline-flex items-center gap-2 rounded border border-[#8D99AE] bg-white px-5 py-3 text-sm font-bold text-[#2B2D42] hover:bg-[#EDF2F4]"><BookOpen className="h-4 w-4"/> Method guide</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[.34fr_1fr]" aria-labelledby="levels-title">
        <div>
          <p className="section-kicker">Prediction hierarchy</p>
          <h2 id="levels-title" className="mt-2 text-3xl font-semibold tracking-[-.025em] text-[#2B2D42]">One sequence, three reporting levels</h2>
          <p className="mt-4 text-sm leading-6 text-[#5e6674]">Each level answers a progressively more specific localization question.</p>
        </div>
        <div className="border-t-2 border-[#2B2D42]">
          {levels.map(([level, title, copy], index) => (
            <article key={level} className="grid gap-3 border-b border-[#cfd4dc] bg-white px-1 py-6 sm:grid-cols-[7rem_12rem_1fr] sm:items-start sm:gap-5">
              <span className="text-xs font-black uppercase tracking-[.14em] text-[#D90429]">0{index + 1} / {level}</span>
              <h3 className="text-base font-semibold text-[#2B2D42]">{title}</h3>
              <p className="text-sm leading-6 text-[#5e6674]">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid overflow-hidden border border-[#8D99AE] bg-white md:grid-cols-[1fr_auto]">
        <div className="p-7 sm:p-9">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#D90429]"><Layers3 className="h-4 w-4"/> Analysis options</div>
          <h2 className="mt-3 text-2xl font-semibold text-[#2B2D42]">Use the web server for interactive work or the package for larger analyses.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5e6674]">Paste FASTA sequences, upload a file, or retrieve a protein by accession. Downloadable software is available for local and scripted workflows.</p>
        </div>
        <div className="flex flex-col justify-center gap-3 border-t border-[#cfd4dc] bg-[#EDF2F4] p-7 md:min-w-56 md:border-l md:border-t-0">
          <Link href="/prediction" className="inline-flex items-center justify-between gap-3 text-sm font-bold text-[#2B2D42] hover:text-[#D90429]">Open prediction <ArrowRight className="h-4 w-4"/></Link>
          <Link href="/download" className="inline-flex items-center justify-between gap-3 border-t border-[#c5ccd6] pt-3 text-sm font-bold text-[#2B2D42] hover:text-[#D90429]">Get the package <Download className="h-4 w-4"/></Link>
        </div>
      </section>
    </div>
  );
}
