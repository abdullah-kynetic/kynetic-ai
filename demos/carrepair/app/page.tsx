import { Header } from "@/components/Header";
import { EstimateDialog } from "@/components/EstimateDialog";
import { Hero } from "@/components/Hero";
import { Community, CaseStudy, CTAFooter, FAQ, HowItWorks, Pricing, Reviews, Services, Team, Why } from "@/components/Sections";

export default function Home() {
  return (
    <>
      <Header />
      <EstimateDialog />
      <main>
        <Hero /><Services /><HowItWorks /><Why /><CaseStudy /><Reviews /><Team /><Pricing /><Community /><FAQ />
      </main>
      <CTAFooter />
    </>
  );
}
