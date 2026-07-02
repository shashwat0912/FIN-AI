const faqs = [
  ['Is my financial data secure?', 'FinanceAI is designed as a private intelligence layer. You control what you add and can remove data when needed.'],
  ['How does the AI work?', 'It uses your transaction history, categories, budgets, and goals to explain changes and suggest next steps.'],
  ['Can I add transactions manually?', 'Yes. You can add transactions manually and use imports where your current app supports them.'],
  ['Does FinanceAI replace my bank?', 'No. FinanceAI helps you understand money. It does not hold deposits or move funds on your behalf.'],
  ['What is the difference between Free and Pro?', 'Free covers tracking basics. Pro adds deeper AI analysis, projections, alerts, and goal planning.'],
  ['Can I cancel anytime?', 'Yes. Plans are intended to be simple and reversible from account settings.'],
];

export function FaqSection() {
  return (
    <section id="faq" data-testid="faq-section" className="relative py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 sm:px-8 lg:grid-cols-12">
        <div className="reveal lg:col-span-5">
          <h2 className="font-display text-balance text-4xl font-semibold tracking-tighter text-white sm:text-5xl">Questions, answered.</h2>
          <p className="mt-4 max-w-md text-zinc-400">Ready to try it? <a href="/signup" className="text-emerald-400 underline-offset-4 hover:underline">Create your account</a>.</p>
        </div>
        <div className="reveal lg:col-span-7">
          <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-950/60">
            {faqs.map(([question, answer], index) => (
              <details key={question} data-testid={`faq-item-${index}`} className="group px-6 open:bg-white/[0.02]">
                <summary className="cursor-pointer list-none py-5 text-left text-base font-medium text-white marker:hidden">
                  <span className="flex items-center justify-between gap-6">
                    {question}
                    <span className="text-emerald-400 transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-zinc-400">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
