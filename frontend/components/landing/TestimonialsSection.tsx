const quotes = [
  ['FinanceAI caught a subscription increase I would have ignored for months.', 'Mira Shah', 'Product lead'],
  ['The monthly brief is the first finance summary I actually read.', 'Arjun Menon', 'Founder'],
  ['It feels less like accounting software and more like a calm money analyst.', 'Devika Rao', 'Designer'],
];

export function TestimonialsSection() {
  return (
    <section data-testid="testimonials-section" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="reveal mx-auto max-w-3xl text-center">
          <h2 className="font-display text-balance text-4xl font-semibold tracking-tighter text-white sm:text-5xl">Built for the moment you check your money.</h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">Short, readable, and specific enough to act on.</p>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {quotes.map(([quote, name, role]) => (
            <figure key={name} className="reveal flex h-full flex-col justify-between rounded-2xl border border-white/[0.06] bg-zinc-950/60 p-7 backdrop-blur">
              <blockquote className="font-display text-[17px] leading-relaxed tracking-tight text-zinc-100">{quote}</blockquote>
              <figcaption className="mt-8 border-t border-white/[0.06] pt-4">
                <div className="text-sm font-medium text-white">{name}</div>
                <div className="text-xs text-zinc-500">{role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
