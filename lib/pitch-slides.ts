import { TitleSlide } from "@/components/pitch/TitleSlide";
import { ProblemSlide } from "@/components/pitch/ProblemSlide";
import { SolutionSlide } from "@/components/pitch/SolutionSlide";
import { ProductSlide } from "@/components/pitch/ProductSlide";
import { MarketSlide } from "@/components/pitch/MarketSlide";
import { HowItWorksSlide } from "@/components/pitch/HowItWorksSlide";
import { BusinessModelSlide } from "@/components/pitch/BusinessModelSlide";
import { TractionSlide } from "@/components/pitch/TractionSlide";
import { TeamSlide } from "@/components/pitch/TeamSlide";
import { AskSlide } from "@/components/pitch/AskSlide";

export const PITCH_SLIDES = [
    { id: 1, component: TitleSlide, title: "Title" },
    { id: 2, component: ProblemSlide, title: "Problem" },
    { id: 3, component: SolutionSlide, title: "Solution" },
    { id: 4, component: ProductSlide, title: "Product" },
    { id: 5, component: MarketSlide, title: "Market" },
    { id: 6, component: HowItWorksSlide, title: "How It Works" },
    { id: 7, component: BusinessModelSlide, title: "Business Model" },
    { id: 8, component: TractionSlide, title: "Traction" },
    { id: 9, component: TeamSlide, title: "Team" },
    { id: 10, component: AskSlide, title: "Ask" },
];
