import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { CaseStudy, CTAFooter, FAQ, Guarantee, HowItWorks, Pricing, Reviews, Services, Team, Why } from "@/components/Sections";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero /><Services /><HowItWorks /><Why /><CaseStudy /><Reviews /><Team /><Pricing /><Guarantee /><FAQ />
      </main>
      <CTAFooter />
    </>
  );
}
