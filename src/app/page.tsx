import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Download } from 'lucide-react';
import { withBasePath } from '@/lib/base-path';

export default function Home() {
  return (
    <div className="pb-14 pt-7 sm:pt-10">
      <section className="mx-auto max-w-5xl text-center" aria-labelledby="hero-title">
        <h1 id="hero-title" className="mx-auto max-w-3xl text-3xl font-bold leading-tight text-[#24282c] sm:text-4xl">
          Subcellular Localization Prediction of Legume Crop Proteins
        </h1>

        <figure className="mt-9">
          <div className="overflow-hidden border border-[#c9c9c9] bg-white p-2 shadow-sm sm:p-4">
            <Image
              src={withBasePath('/assets/images/legumeloc-workflow.svg')}
              alt="LegumeLoc hierarchical workflow from protein sequences through DPCP or TPC feature extraction and deep-learning models to single and dual localization results"
              width={1600}
              height={760}
              className="h-auto w-full"
              priority
            />
          </div>
          <figcaption className="mt-2 text-xs text-[#657078]">Overview of the LegumeLoc prediction workflow and hierarchical output levels.</figcaption>
        </figure>

        <p className="mx-auto mt-8 max-w-4xl text-left font-serif text-[1.08rem] leading-8 text-[#303438] sm:text-justify sm:text-lg">
          Unlocking the mysteries of protein localization is crucial for understanding cellular functions. In the realm of legume crops, this knowledge is pivotal for enhancing agricultural productivity and sustainability. LegumeLoc harnesses the power of deep learning models to predict the subcellular localization of legume crop proteins with unprecedented accuracy and efficiency. LegumeLoc offers a user-friendly interface that simplifies complex analyses, enabling users to explore the intricate world of protein localization with ease. Our deep learning model utilizes a multi-layered architecture with a combination of convolutional neural networks (CNNs) for subcellular localization prediction. Various subcellular localizations predicted are nucleus, cytoplasm, plastid, membrane, endoplasmic reticulum, golgi apparatus, cell membrane, mitochondria, secreted, peroxisome, and vacuole. Additionally, LegumeLoc also supports prediction of dual subcellular localization of proteins. Users can select the Fast model for larger datasets or the Sensitive model for higher-detail prediction.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/prediction" className="inline-flex items-center gap-2 rounded bg-[#1c7e9c] px-7 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#14657c]">
            Prediction <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/download" className="inline-flex items-center gap-2 rounded bg-[#a9632f] px-7 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#874c22]">
            Download <Download className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
