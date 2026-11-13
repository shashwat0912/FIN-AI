import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const links = [
  { label: 'Product', href: '#features' },
  { label: 'Showcase', href: '#showcase' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const underline =
  'after:absolute after:inset-x-0 after:-bottom-1.5 after:h-px after:origin-left after:bg-emerald-400 after:transition-transform after:duration-300 after:ease-[cubic-bezier(0.22,1,0.36,1)]';

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The tab whose section crosses a line 40% down the viewport is current; none while between tracked sections.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach(({ target, isIntersecting }) => {
          const href = `#${target.id}`;
          setActive((current) => (isIntersecting ? href : current === href ? null : current));
        }),
      { rootMargin: '-40% 0px -60% 0px' }
    );
    links.forEach(({ href }) => {
      const section = document.querySelector(href);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <header
      data-testid="site-nav"
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl' : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8">
        <Link to="/" onClick={() => window.scrollTo({ top: 0 })} data-testid="nav-logo" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-500 text-zinc-950">
            <span className="font-display text-sm font-bold">F</span>
          </span>
          <span className="font-display text-base font-semibold tracking-tight text-white">FinanceAI</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={active === link.href ? 'location' : undefined}
              className={`relative text-sm transition-colors ${underline} ${
                active === link.href
                  ? 'text-white after:scale-x-100'
                  : 'text-zinc-400 after:scale-x-0 hover:text-white hover:after:scale-x-100'
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <Link to="/login" data-testid="nav-signin" className="text-sm text-zinc-400 transition-colors hover:text-white">
            Sign in
          </Link>
          <Link
            to="/signup"
            data-testid="nav-cta-start"
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400"
          >
            Start free
          </Link>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="nav-mobile-menu"
          data-testid="nav-mobile-toggle"
          onClick={() => setOpen((value) => !value)}
          className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-zinc-300 md:hidden"
        >
          <span className="relative grid h-4 w-4 place-items-center">
            <Menu size={16} className={`absolute transition duration-200 ${open ? 'rotate-90 scale-75 opacity-0' : ''}`} />
            <X size={16} className={`absolute transition duration-200 ${open ? '' : '-rotate-90 scale-75 opacity-0'}`} />
          </span>
        </button>
      </div>

      {/* Stays mounted so it can slide shut; invisible (and out of the tab order) once closed. */}
      <div
        id="nav-mobile-menu"
        data-testid="nav-mobile-menu"
        className={`grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden ${
          open ? 'visible grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-white/[0.06] bg-zinc-950/95 backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active === link.href ? 'location' : undefined}
                  className={`rounded-md px-2 py-2 text-sm hover:bg-white/[0.04] ${active === link.href ? 'text-white' : 'text-zinc-300'}`}
                >
                  {link.label}
                </a>
              ))}
              <Link to="/login" onClick={() => setOpen(false)} className="rounded-md px-2 py-2 text-sm text-zinc-300 hover:bg-white/[0.04]">
                Sign in
              </Link>
              <Link to="/signup" onClick={() => setOpen(false)} className="mt-2 rounded-full bg-emerald-500 px-4 py-2 text-center text-sm font-medium text-zinc-950">
                Start free
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
