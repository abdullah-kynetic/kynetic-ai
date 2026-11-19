import { Header } from "@/components/Header";
import { EstimateDialog } from "@/components/EstimateDialog";
import { MobileBar } from "@/components/MobileBar";
import { Hero } from "@/components/Hero";
import { Community, CaseStudy, CTAFooter, FAQ, HowItWorks, Pricing, Reviews, Services, Team, Why } from "@/components/Sections";

export default function Home() {
  return (
    <>
      <Header />
      <EstimateDialog />
      <MobileBar />
      <main>
        <Hero /><Services /><HowItWorks /><Why /><CaseStudy /><Reviews /><Team /><Pricing /><Community /><FAQ />
      </main>
      <CTAFooter />
      <div className="h-[72px] md:hidden" aria-hidden />
    </>
  );
}
