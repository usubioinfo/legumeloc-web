'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { BookOpen, Download, FlaskConical, Home } from 'lucide-react';
import { withBasePath } from '@/lib/base-path';

const items = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Prediction', href: '/prediction', icon: FlaskConical },
  { name: 'Download', href: '/download', icon: Download },
  { name: 'User guide', href: '/help', icon: BookOpen },
];

export default function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-[#8b4d23] bg-[#a9632f] shadow-md">
      <div className="mx-auto flex h-[70px] max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        <Link href="/" className="mr-auto flex min-w-0 items-center gap-2 text-white sm:gap-3">
          <span className="rounded bg-white px-2 py-1 shadow-sm"><Image src={withBasePath('/assets/images/lab_logo_red.png')} alt="KAABiL Lab" width={104} height={30} className="h-6 w-auto shrink-0 object-contain" priority /></span>
          <span className="hidden h-8 w-px bg-white/35 sm:block" aria-hidden="true" />
          <span><strong className="block text-lg leading-none sm:text-xl">LegumeLoc</strong><small className="mt-1 hidden text-[9px] font-semibold uppercase tracking-[.12em] text-white/75 sm:block">Legume protein localization</small></span>
        </Link>
        <nav className="flex h-full items-center" aria-label="Primary navigation">
          {items.map(({ name, href, icon: Icon }) => {
            const active = pathname === href;
            return <Link key={href} href={href} aria-label={name} aria-current={active ? 'page' : undefined} className={`relative flex h-full items-center gap-2 px-2 text-sm font-semibold transition sm:px-4 ${active ? 'text-white' : 'text-white/80 hover:text-white'}`}><Icon className="h-4 w-4 sm:hidden"/><span className="hidden sm:inline">{name}</span>{active && <span className="absolute inset-x-2 bottom-0 h-1 bg-[#1c7e9c] sm:inset-x-4"/>}</Link>;
          })}
        </nav>
      </div>
    </header>
  );
}
