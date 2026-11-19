import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Community, CaseStudy, CTAFooter, FAQ, HowItWorks, Pricing, Reviews, Services, Team, Why } from "@/components/Sections";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero /><Services /><HowItWorks /><Why /><CaseStudy /><Reviews /><Team /><Pricing /><Community /><FAQ />
      </main>
      <CTAFooter />
    </>
  );
}
