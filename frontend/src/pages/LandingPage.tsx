import {
  DashboardPreview,
  FAQSection,
  FeaturesSection,
  Footer,
  HeroSection,
  HowItWorks,
  Navbar,
  PricingSection,
  Testimonials,
  TrustedCompanies,
} from "@/components/landing"

export function LandingPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:shadow-soft"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main-content">
        <HeroSection />
        <TrustedCompanies />
        <FeaturesSection />
        <HowItWorks />
        <DashboardPreview />
        <PricingSection />
        <Testimonials />
        <FAQSection />
      </main>
      <Footer />
    </div>
  )
}
