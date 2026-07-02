import { Github, Linkedin, Twitter } from 'lucide-react';

const columns: Array<[string, string[]]> = [
  ['Product', ['Features', 'Showcase', 'Pricing']],
  ['Resources', ['FAQ', 'Security', 'Support']],
  ['Company', ['About', 'Careers', 'Contact']],
  ['Legal', ['Privacy', 'Terms', 'Data']],
];

function footerHref(item: string) {
  if (item === 'Features') return '#features';
  if (item === 'Showcase') return '#showcase';
  if (item === 'Pricing') return '#pricing';
  if (item === 'FAQ') return '#faq';
  return '/login';
}

export function LandingFooter() {
  return (
    <footer data-testid="footer" className="border-t border-white/[0.06] bg-zinc-950 py-14">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <a href="/" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-500 text-zinc-950"><span className="font-display text-sm font-bold">F</span></span>
              <span className="font-display text-base font-semibold tracking-tight text-white">FinanceAI</span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">Understand spending, budgets, goals, and the decisions that move them.</p>
            <div className="mt-5 flex gap-3 text-zinc-500">
              <a href="/login" aria-label="Twitter" className="hover:text-white"><Twitter size={17} /></a>
              <a href="/login" aria-label="GitHub" className="hover:text-white"><Github size={17} /></a>
              <a href="/login" aria-label="LinkedIn" className="hover:text-white"><Linkedin size={17} /></a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 md:col-span-8 md:grid-cols-4">
            {columns.map(([title, items]) => (
              <div key={title}>
                <h3 className="text-xs font-medium uppercase tracking-widest text-zinc-500">{title}</h3>
                <ul className="mt-4 space-y-3">
                  {items.map((item) => (
                    <li key={item}><a href={footerHref(item)} className="text-sm text-zinc-400 hover:text-white">{item}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 FinanceAI. All rights reserved.</span>
          <span className="relative inline-flex items-center gap-2"><span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500"><span className="dot-ping absolute inset-0 rounded-full" /></span>Public landing and private dashboard</span>
        </div>
      </div>
    </footer>
  );
}
