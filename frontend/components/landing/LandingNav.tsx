import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

const links = [
  { label: 'Product', href: '#features' },
  { label: 'Showcase', href: '#showcase' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      data-testid="site-nav"
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl' : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8">
        <a href="/" data-testid="nav-logo" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-500 text-zinc-950">
            <span className="font-display text-sm font-bold">F</span>
          </span>
          <span className="font-display text-base font-semibold tracking-tight text-white">FinanceAI</span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-zinc-400 transition-colors hover:text-white">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <a href="/login" data-testid="nav-signin" className="text-sm text-zinc-400 transition-colors hover:text-white">
            Sign in
          </a>
          <a
            href="/signup"
            data-testid="nav-cta-start"
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400"
          >
            Start free
          </a>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          data-testid="nav-mobile-toggle"
          onClick={() => setOpen((value) => !value)}
          className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-zinc-300 md:hidden"
        >
          {open ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {open && (
        <div data-testid="nav-mobile-menu" className="border-t border-white/[0.06] bg-zinc-950/95 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-md px-2 py-2 text-sm text-zinc-300 hover:bg-white/[0.04]">
                {link.label}
              </a>
            ))}
            <a href="/login" onClick={() => setOpen(false)} className="rounded-md px-2 py-2 text-sm text-zinc-300 hover:bg-white/[0.04]">
              Sign in
            </a>
            <a href="/signup" onClick={() => setOpen(false)} className="mt-2 rounded-full bg-emerald-500 px-4 py-2 text-center text-sm font-medium text-zinc-950">
              Start free
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
