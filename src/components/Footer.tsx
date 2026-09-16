import Image from 'next/image';
import { withBasePath } from '@/lib/base-path';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[#cfd4dc] bg-white py-7">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 sm:px-6 md:flex-row lg:px-8">
        <div><p className="text-lg font-semibold text-[#2B2D42]">LegumeLoc</p><p className="mt-1 text-xs text-[#727b8b]">© 2024 KAABiL Lab, Utah State University</p></div>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <a href="https://kaabil.net" target="_blank" rel="noopener noreferrer"><Image src={withBasePath('/assets/images/lab_logo_red.png')} alt="KAABiL Lab" width={106} height={32} className="h-8 w-auto object-contain"/></a>
          <a href="https://usu.edu" target="_blank" rel="noopener noreferrer"><Image src={withBasePath('/assets/images/usulogo2.png')} alt="Utah State University" width={103} height={32} className="h-8 w-auto object-contain"/></a>
          <a href="https://psc.usu.edu" target="_blank" rel="noopener noreferrer"><Image src={withBasePath('/assets/images/PSC_NoTower_Blue.png')} alt="USU Plants, Soils and Climate" width={167} height={32} className="h-8 w-auto object-contain"/></a>
        </div>
      </div>
    </footer>
  );
}
