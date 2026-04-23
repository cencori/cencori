import { MomentSlide } from "@/components/pitch/MomentSlide";
import { TitleSlide } from "@/components/pitch/TitleSlide";
import { ProblemSlide } from "@/components/pitch/ProblemSlide";
import { MarketSlide } from "@/components/pitch/MarketSlide";
import { SolutionSlide } from "@/components/pitch/SolutionSlide";
import { ProductSlide } from "@/components/pitch/ProductSlide";
import { BusinessModelSlide } from "@/components/pitch/BusinessModelSlide";
import { TractionSlide } from "@/components/pitch/TractionSlide";
import { FinancialsSlide } from "@/components/pitch/FinancialsSlide";
import { CompetitiveSlide } from "@/components/pitch/CompetitiveSlide";
import { VisionSlide } from "@/components/pitch/VisionSlide";
import { TeamSlide } from "@/components/pitch/TeamSlide";
import { AskSlide } from "@/components/pitch/AskSlide";
import { ClosingSlide } from "@/components/pitch/ClosingSlide";

export const PITCH_SLIDES = [
    { id: 1, component: TitleSlide, title: "Cover" },
    { id: 2, component: MomentSlide, title: "The Moment" },
    { id: 3, component: ProblemSlide, title: "Problem" },
    { id: 4, component: MarketSlide, title: "Market" },
    { id: 5, component: SolutionSlide, title: "Solution" },
    { id: 6, component: ProductSlide, title: "Product" },
    { id: 7, component: TractionSlide, title: "Traction" },
    { id: 8, component: BusinessModelSlide, title: "Business Model" },
    { id: 9, component: FinancialsSlide, title: "Financial Projections" },
    { id: 10, component: CompetitiveSlide, title: "Competition" },
    { id: 11, component: VisionSlide, title: "Vision" },
    { id: 12, component: TeamSlide, title: "Team" },
    { id: 13, component: AskSlide, title: "Ask" },
    { id: 14, component: ClosingSlide, title: "Closing" },
];
