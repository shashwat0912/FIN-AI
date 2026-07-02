import { BuiltBySection } from '../components/landing/BuiltBySection';
import { CtaSection } from '../components/landing/CtaSection';
import { FaqSection } from '../components/landing/FaqSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { HeroSection } from '../components/landing/HeroSection';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { LandingFooter } from '../components/landing/LandingFooter';
import { LandingNav } from '../components/landing/LandingNav';
import { PricingSection } from '../components/landing/PricingSection';
import { ShowcaseSection } from '../components/landing/ShowcaseSection';
import { TestimonialsSection } from '../components/landing/TestimonialsSection';
import { WhyFinanceAISection } from '../components/landing/WhyFinanceAISection';
import { useReveal } from '../hooks/useReveal';

export default function LandingPage() {
  useReveal();

  return (
    <div data-testid="landing-page" className="landing-page min-h-screen bg-[#09090b] text-white antialiased">
      <LandingNav />
      <main>
        <HeroSection />
        <BuiltBySection />
        <FeaturesSection />
        <ShowcaseSection />
        <HowItWorksSection />
        <WhyFinanceAISection />
        <TestimonialsSection />
        <PricingSection />
        <FaqSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
