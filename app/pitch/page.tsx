"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Script from "next/script";
import { Anthropic } from "@lobehub/icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
    GlobalIcon,
    EarthLockIcon,
    CloudIcon,
    JusticeScale01Icon,
    CpuIcon,
    AiChipIcon,
    ChipIcon,
    Coins01Icon,
    ExchangeDollarIcon,
    BankIcon,
    Layers01Icon,
    ServerStack01Icon,
    SecurityCheckIcon,
    ConnectIcon,
    Key01Icon,
    Shield01Icon,
    Calendar03Icon,
    Clock01Icon,
    Rocket01Icon,
    UserGroupIcon,
    SourceCodeIcon,
    Agreement01Icon,
    Exchange01Icon,
    Hospital01Icon,
    Plant01Icon,
    CourtHouseIcon,
    DeliveryTruck01Icon,
    Building06Icon,
    Configuration01Icon,
    CheckmarkBadge01Icon,
} from "@hugeicons/core-free-icons";
import { CheckIcon, ShapesIcon, BarChartIcon } from "@/assets/icons";

function HIcon({
    icon,
    size = 20,
    color = "currentColor",
    sw = 1.5,
    style,
}: {
    icon: IconSvgElement;
    size?: number;
    color?: string;
    sw?: number;
    style?: React.CSSProperties;
}) {
    return <HugeiconsIcon icon={icon} size={size} color={color} strokeWidth={sw} style={style} />;
}

function PitchDeckContent() {
    const searchParams = useSearchParams();
    const [isPrintMode, setIsPrintMode] = useState(false);

    useEffect(() => {
        if (searchParams.get("print") === "true") {
            setIsPrintMode(true);
            document.body.setAttribute("data-ready", "true");
        }
    }, [searchParams]);

    const [current, setCurrent] = useState(0);
    const total = 10;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
                setCurrent((prev) => (prev + 1) % total);
            }
            if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                setCurrent((prev) => (prev - 1 + total) % total);
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [total]);

    const goTo = (n: number) => setCurrent(n);
    const navigate = (dir: number) => setCurrent((prev) => (prev + dir + total) % total);

    const downloadPDF = async () => {
        window.location.href = "/api/pitch/export?format=pdf";
    };

    return (
        <>
            <div className="mobile-wall">
                <img src="/logo white.svg" alt="Cencori Logo" style={{ width: "60px", height: "auto", marginBottom: "60px" }} />
                <div className="mobile-wall-message">Best experienced on a<br />high-resolution display.</div>
                <div className="mobile-wall-sub">
                    This deck covers dense technical and financial detail. Please open it on a desktop to review the full sovereign-infrastructure roadmap.
                </div>
            </div>

            <div className="pitch-deck-container">
            <Script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js" strategy="afterInteractive" />
            <style jsx global>{`
                .pitch-deck-container {
                    --black: #000000;
                    --white: #FFFFFF;
                    --muted: #A3A3A3;
                    --muted-light: #D4D4D4;
                    --border: #262626;
                    --border-light: #E5E5E5;

                    --font-display: var(--font-geist-sans), system-ui, sans-serif;
                    --font-body: var(--font-inter), system-ui, sans-serif;
                    --font-code: var(--font-mono), ui-monospace, monospace;

                    width: 100vw;
                    height: 100vh;
                    background: #000;
                    font-family: var(--font-body);
                    overflow: hidden;
                    position: fixed;
                    top: 0;
                    left: 0;
                    z-index: 9999;
                }

                .deck { width: 100%; height: 100%; position: relative; }
                .slide { position: absolute; inset: 0; display: none; overflow: hidden; }
                .slide.active { display: flex; }

                ${isPrintMode ? `
                    html, body, #__next, .pitch-deck-container {
                        height: auto !important;
                        min-height: auto !important;
                        overflow: visible !important;
                        position: relative !important;
                    }
                    .deck {
                        height: auto !important;
                        overflow: visible !important;
                        position: relative !important;
                        display: block !important;
                    }
                    .slide {
                        position: relative !important;
                        display: flex !important;
                        page-break-after: always !important;
                        height: 1080px !important;
                        width: 1920px !important;
                        min-height: 1080px !important;
                        margin: 0 auto !important;
                    }
                    .nav, .export-btn, .slide-counter, .slide-logo { display: none !important; }
                ` : ""}

                .mobile-wall {
                    display: none;
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    background: #000;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: 40px;
                    text-align: center;
                }

                .mobile-wall-message {
                    font-family: var(--font-geist-sans), system-ui, sans-serif;
                    font-size: 28px;
                    font-weight: 600;
                    color: #fff;
                    line-height: 1.3;
                    margin-bottom: 24px;
                    letter-spacing: -0.02em;
                }

                .mobile-wall-sub {
                    font-family: var(--font-mono), ui-monospace, monospace;
                    font-size: 10px;
                    letter-spacing: 0.1em;
                    color: #A3A3A3;
                    line-height: 1.8;
                    max-width: 260px;
                    text-transform: uppercase;
                }

                @media (max-width: 1024px) {
                    .pitch-deck-container { display: none; }
                    .mobile-wall { display: flex; }
                }

                .nav { position: fixed; bottom: 36px; left: 50%; transform: translateX(-50%); z-index: 10000; display: flex; align-items: center; gap: 20px; }
                .nav-dots { display: flex; gap: 6px; }
                .dot { width: 4px; height: 4px; border-radius: 50%; background: #333; cursor: pointer; transition: all .3s; }
                .dot.active { background: #fff; width: 20px; border-radius: 2px; }
                .nav-btn { background: none; border: 1px solid #333; color: #A3A3A3; font-family: var(--font-code); font-size: 10px; letter-spacing: .1em; padding: 6px 14px; cursor: pointer; transition: all .2s; }
                .nav-btn:hover { border-color: #fff; color: #fff; }

                .export-btn { position: fixed; bottom: 36px; right: 40px; z-index: 10001; background: none; border: 1px solid #222; color: #555; font-family: var(--font-code); font-size: 9px; letter-spacing: .15em; text-transform: uppercase; padding: 6px 14px; cursor: pointer; transition: all .2s; }
                .export-btn:hover { border-color: #fff; color: #fff; }

                @media print {
                    html, body { width: 100%; height: auto; overflow: visible !important; background: #fff; }
                    .deck { width: 100%; height: auto; position: static; }
                    .slide { position: relative !important; display: flex !important; width: 100vw; height: 100vh; page-break-after: always; break-after: page; overflow: hidden; }
                    .slide.active { display: flex !important; }
                    .nav, .slide-counter, .slide-logo, .export-btn { display: none !important; }
                    @page { size: landscape; margin: 0; }
                }

                .slide-counter { position: fixed; top: 28px; right: 40px; font-family: var(--font-code); font-size: 11px; color: #444; letter-spacing: .1em; z-index: 10000; }
                .slide-logo { position: fixed; top: 28px; left: 40px; z-index: 10000; }

                /* SHARED */
                .kicker { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
                .chip-sm { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #262626; border-radius: 4px; flex-shrink: 0; }
                .chip-sm.light { border-color: #e5e5e5; }
                .chip { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #262626; border-radius: 5px; flex-shrink: 0; }
                .chip.light { border-color: #e5e5e5; }
                .eyebrow { font-family: var(--font-code); font-size: 10px; letter-spacing: .2em; color: #737373; text-transform: uppercase; margin: 0; }
                .eyebrow-dark { font-family: var(--font-code); font-size: 10px; letter-spacing: .2em; color: #666; text-transform: uppercase; margin: 0; }
                .headline-dark { font-family: var(--font-display); font-size: clamp(34px, 3.8vw, 52px); font-weight: 700; line-height: 1.04; letter-spacing: -0.025em; color: #000; margin-bottom: 24px; }
                .headline-light { font-family: var(--font-display); font-size: clamp(34px, 3.8vw, 52px); font-weight: 700; line-height: 1.04; letter-spacing: -0.025em; color: #fff; margin-bottom: 24px; }
                .body-dark { font-size: 14px; color: #444; line-height: 1.75; font-weight: 400; margin-bottom: 16px; }
                .body-light { font-size: 14px; color: #8a8a8a; line-height: 1.75; font-weight: 400; margin-bottom: 16px; }
                .big-quote { font-family: var(--font-display); font-size: clamp(22px, 2.6vw, 32px); font-weight: 500; line-height: 1.25; letter-spacing: -0.02em; color: #000; border-left: 2px solid #000; padding-left: 24px; margin: 32px 0; }

                /* SLIDE 1 - THE COMPANY */
                .s1 { background: #000; flex-direction: column; justify-content: center; padding: 0 10%; }
                .s1-eyebrow { font-family: var(--font-code); font-size: 11px; letter-spacing: .2em; color: #A3A3A3; text-transform: uppercase; }
                .s1-statline { font-family: var(--font-display); font-size: clamp(40px, 5.6vw, 78px); font-weight: 700; line-height: 1.02; letter-spacing: -0.03em; color: #fff; margin: 28px 0 36px; max-width: 1200px; }
                .s1-statline em { font-style: normal; color: #777; }
                .s1-thesis { display: flex; align-items: center; gap: 12px; font-size: 15px; color: #A3A3A3; font-weight: 400; letter-spacing: .01em; margin-bottom: 44px; }
                .s1-thesis strong { color: #fff; font-weight: 600; }
                .s1-meta { display: flex; gap: 48px; border-top: 1px solid #262626; padding-top: 32px; }
                .s1-meta-item label { display: block; font-family: var(--font-code); font-size: 10px; letter-spacing: .15em; color: #777; text-transform: uppercase; margin-bottom: 6px; }
                .s1-meta-item span { font-size: 14px; color: #fff; font-weight: 500; }

                /* SLIDE 2 - THE BELIEF */
                .s2 { background: #fff; flex-direction: row; }
                .s2-left { width: 52%; padding: 8% 5% 8% 10%; display: flex; flex-direction: column; justify-content: center; }
                .s2-right { width: 48%; padding: 8% 10% 8% 5%; border-left: 1px solid #e5e5e5; display: flex; flex-direction: column; justify-content: center; }
                .s2-answer { font-family: var(--font-code); font-size: 11px; color: #737373; letter-spacing: .08em; margin-bottom: 28px; }
                .s2-statement { font-family: var(--font-display); font-size: clamp(20px, 2.4vw, 31px); font-weight: 600; color: #000; line-height: 1.2; letter-spacing: -0.02em; }
                .s2-conviction { font-family: var(--font-code); font-size: 10px; letter-spacing: .2em; color: #737373; text-transform: uppercase; margin-bottom: 20px; }
                .s2-belief-item { display: flex; gap: 14px; padding: 15px 0; border-bottom: 1px solid #f0f0f0; }
                .s2-belief-item:last-child { border-bottom: none; }
                .s2-belief-text { font-size: 13.5px; color: #333; line-height: 1.6; font-weight: 400; }
                .s2-belief-text strong { color: #000; font-weight: 600; }

                /* SLIDE 3 - THE PROBLEM */
                .s3 { background: #000; flex-direction: column; justify-content: center; padding: 0 10%; }
                .s3-headline { font-family: var(--font-display); font-size: clamp(32px, 3.6vw, 50px); font-weight: 700; line-height: 1.05; letter-spacing: -0.025em; color: #fff; margin-bottom: 40px; }
                .problem-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #1a1a1a; border: 1px solid #1a1a1a; }
                .problem-item { background: #000; padding: 30px 26px; }
                .problem-num { font-family: var(--font-code); font-size: 10px; letter-spacing: .2em; color: #555; margin: 18px 0 10px; }
                .problem-title { font-family: var(--font-display); font-size: 19px; font-weight: 600; letter-spacing: -0.01em; color: #fff; margin-bottom: 10px; }
                .problem-desc { font-size: 12.5px; color: #9a9a9a; line-height: 1.65; font-weight: 400; }
                .s3-result { border: 1px solid #1a1a1a; margin-top: 28px; padding: 22px 30px; display: flex; align-items: center; gap: 36px; }
                .s3-result-label { font-family: var(--font-code); font-size: 10px; letter-spacing: .2em; color: #555; text-transform: uppercase; white-space: nowrap; }
                .s3-result-list { display: flex; gap: 36px; flex: 1; }
                .s3-result-item { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #9a9a9a; }
                .s3-result-item strong { color: #fff; font-weight: 500; }

                /* SLIDE 4 - THE SOLUTION */
                .s4 { background: #fff; flex-direction: column; justify-content: center; padding: 0 10%; }
                .s4-subhead { font-size: 14px; color: #737373; font-weight: 400; margin-bottom: 32px; max-width: 680px; line-height: 1.7; }
                .engines-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #e5e5e5; border: 1px solid #e5e5e5; margin-bottom: 24px; }
                .engine-card { background: #fff; padding: 28px; }
                .engine-card.featured { background: #000; }
                .engine-head { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
                .engine-card-label { font-family: var(--font-code); font-size: 9px; letter-spacing: .2em; color: #737373; text-transform: uppercase; margin-bottom: 4px; }
                .engine-card.featured .engine-card-label { color: #888; }
                .engine-card-title { font-family: var(--font-display); font-size: 23px; font-weight: 600; color: #000; line-height: 1; letter-spacing: -0.02em; }
                .engine-card.featured .engine-card-title { color: #fff; }
                .engine-list { display: flex; flex-direction: column; gap: 10px; }
                .eng-li { display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: #333; font-weight: 400; line-height: 1.4; }
                .engine-card.featured .eng-li { color: #D4D4D4; }
                .isolation-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #e5e5e5; border: 1px solid #e5e5e5; }
                .isolation-item { background: #fff; padding: 18px 22px; }
                .isolation-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
                .isolation-title { font-family: var(--font-code); font-size: 9px; letter-spacing: .12em; color: #000; text-transform: uppercase; font-weight: 500; }
                .isolation-desc { font-size: 11.5px; color: #737373; line-height: 1.55; font-weight: 400; }

                /* SLIDE 5 - WHY NOW */
                .s5 { background: #000; flex-direction: column; justify-content: center; padding: 0 10%; }
                .timeline-eras { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #1a1a1a; border: 1px solid #1a1a1a; margin-bottom: 28px; }
                .timeline-era { background: #000; padding: 26px 24px; }
                .timeline-era.future { background: #0c0c0c; border: 1px solid #333; }
                .timeline-era-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
                .timeline-era-label { font-family: var(--font-code); font-size: 10px; letter-spacing: .2em; color: #555; text-transform: uppercase; }
                .timeline-era-title { font-family: var(--font-display); font-size: 24px; font-weight: 600; color: #fff; line-height: 1; letter-spacing: -0.02em; margin-bottom: 8px; }
                .timeline-era-desc { font-size: 12px; color: #9a9a9a; line-height: 1.6; font-weight: 400; }
                .s5-proofs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px; background: #1a1a1a; border: 1px solid #1a1a1a; }
                .s5-proof { background: #000; padding: 20px 16px; display: flex; flex-direction: column; gap: 12px; }
                .s5-proof-text { font-size: 11px; color: #9a9a9a; font-weight: 400; line-height: 1.45; }

                /* SLIDE 6 - TRACTION */
                .s6 { background: #fff; flex-direction: column; justify-content: center; padding: 0 10%; }
                .traction-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #e5e5e5; margin: 32px 0; border: 1px solid #e5e5e5; }
                .traction-item { background: #fff; padding: 26px 24px; }
                .traction-icon { margin-bottom: 18px; }
                .traction-big { font-family: var(--font-display); font-size: 38px; font-weight: 700; color: #000; line-height: 1; letter-spacing: -0.03em; margin-bottom: 8px; }
                .traction-label { font-size: 12px; color: #737373; font-weight: 400; line-height: 1.5; }
                .traction-label strong { font-weight: 600; color: #000; }
                .traction-note { border: 1px solid #e5e5e5; padding: 24px 30px; display: flex; align-items: flex-start; gap: 18px; }
                .traction-note-text { font-size: 13px; color: #333; font-weight: 400; line-height: 1.65; }
                .traction-note-text strong { color: #000; font-weight: 600; }

                /* SLIDE 7 - GO-TO-MARKET */
                .s7 { background: #000; flex-direction: column; justify-content: center; padding: 0 10%; }
                .gtm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #1a1a1a; border: 1px solid #1a1a1a; margin: 28px 0; }
                .gtm-half { background: #000; padding: 30px 28px; }
                .gtm-half-head { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
                .gtm-half-label { font-family: var(--font-code); font-size: 10px; letter-spacing: .15em; color: #555; text-transform: uppercase; margin-bottom: 4px; }
                .gtm-half-title { font-family: var(--font-display); font-size: 23px; font-weight: 600; color: #fff; line-height: 1; letter-spacing: -0.02em; }
                .gtm-list { display: flex; flex-direction: column; gap: 9px; }
                .gtm-list-item { display: flex; align-items: flex-start; gap: 11px; font-size: 12.5px; color: #9a9a9a; font-weight: 400; line-height: 1.45; }
                .gtm-bridge { border: 1px solid #1a1a1a; padding: 20px 28px; display: flex; align-items: flex-start; gap: 18px; }
                .gtm-bridge-text { font-size: 13px; color: #d4d4d4; font-weight: 400; line-height: 1.55; }
                .gtm-bridge-text strong { color: #fff; font-weight: 600; }

                /* SLIDE 8 - MARKET OPPORTUNITY */
                .s8 { background: #fff; flex-direction: column; justify-content: center; padding: 0 10%; }
                .vert-box { border: 1px solid #e5e5e5; margin-top: 26px; }
                .vert-row { display: grid; grid-template-columns: 1.1fr 1.3fr 1.5fr; gap: 24px; padding: 15px 28px; border-bottom: 1px solid #f0f0f0; align-items: center; }
                .vert-row:last-child { border-bottom: none; }
                .vert-name-cell { display: flex; align-items: center; gap: 12px; }
                .vert-name { font-size: 14px; font-weight: 600; color: #000; }
                .vert-stage { font-family: var(--font-code); font-size: 8px; letter-spacing: .1em; color: #999; text-transform: uppercase; display: block; margin-top: 2px; }
                .vert-value { font-size: 12px; color: #333; font-weight: 400; line-height: 1.5; }
                .vert-use { font-size: 12px; color: #737373; font-weight: 400; line-height: 1.5; }
                .econ-box { background: #fafafa; border: 1px solid #e5e5e5; padding: 22px 28px; margin-top: 22px; display: flex; flex-direction: column; gap: 9px; }
                .econ-row { display: flex; justify-content: space-between; font-size: 13px; color: #333; font-weight: 400; }
                .econ-row strong { font-weight: 500; }
                .econ-row.total { border-top: 2px solid #000; padding-top: 12px; margin-top: 4px; font-weight: 600; color: #000; font-size: 14px; }
                .econ-caption { font-family: var(--font-code); font-size: 10px; color: #999; letter-spacing: .05em; margin-top: 16px; text-align: center; }

                /* SLIDE 9 - TEAM */
                .s9 { background: #fff; flex-direction: row; }
                .s9-left { width: 50%; padding: 8% 5% 8% 10%; border-right: 1px solid #e5e5e5; display: flex; flex-direction: column; justify-content: center; }
                .s9-right { width: 50%; padding: 8% 10% 8% 5%; display: flex; flex-direction: column; justify-content: center; }
                .team-member { display: flex; align-items: flex-start; gap: 18px; margin-top: 18px; }
                .team-avatar { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #e5e5e5; }
                .team-info { flex: 1; }
                .team-name { font-family: var(--font-display); font-size: 24px; font-weight: 600; letter-spacing: -0.02em; color: #000; margin-bottom: 3px; }
                .team-title { font-family: var(--font-code); font-size: 10px; letter-spacing: .12em; color: #737373; text-transform: uppercase; margin-bottom: 10px; }
                .team-bio { font-size: 12.5px; color: #555; line-height: 1.7; font-weight: 400; }
                .team-divider { border: none; border-top: 1px solid #e5e5e5; margin: 20px 0; }
                .s9-stat { display: flex; align-items: flex-start; gap: 14px; border: 1px solid #e5e5e5; padding: 16px 20px; margin-bottom: 14px; }
                .s9-stat-label { font-family: var(--font-code); font-size: 9px; letter-spacing: .12em; color: #737373; text-transform: uppercase; margin-bottom: 6px; }
                .s9-stat-text { font-size: 12.5px; color: #333; font-weight: 400; line-height: 1.55; }
                .s9-stat-text strong { font-weight: 600; color: #000; }

                /* SLIDE 10 - THE ASK */
                .s10 { background: #000; flex-direction: column; justify-content: center; padding: 0 10%; }
                .ask-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 1px; background: #1a1a1a; margin-top: 28px; border: 1px solid #1a1a1a; }
                .ask-cell { background: #000; padding: 26px 24px; }
                .ask-cell.featured { background: #fff; }
                .ask-label { font-family: var(--font-code); font-size: 10px; letter-spacing: .2em; color: #888; text-transform: uppercase; margin-bottom: 12px; }
                .ask-label.dark { color: #737373; }
                .ask-value { font-family: var(--font-display); font-size: 38px; font-weight: 700; color: #fff; line-height: 1; letter-spacing: -0.03em; margin-bottom: 8px; }
                .ask-value.dark { color: #000; }
                .ask-value-sub { font-size: 12px; color: #9a9a9a; font-weight: 400; }
                .ask-value-sub.dark { color: #737373; }
                .funds-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12px; }
                .funds-table td { padding: 9px 0; border-bottom: 1px solid #1f1f1f; color: #9a9a9a; vertical-align: middle; }
                .funds-table tr:last-child td { border-bottom: none; }
                .funds-cell { display: flex; align-items: center; gap: 11px; }
                .funds-amt { text-align: right; color: #fff; font-family: var(--font-code); font-size: 11px; white-space: nowrap; }
                .s10-milestones { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #1a1a1a; border: 1px solid #1a1a1a; margin-top: 22px; }
                .s10-milestone { background: #000; padding: 18px 20px; }
                .s10-milestone-month { font-family: var(--font-code); font-size: 9px; letter-spacing: .1em; color: #737373; margin-bottom: 8px; text-transform: uppercase; }
                .s10-milestone-text { font-size: 12px; color: #d4d4d4; font-weight: 400; line-height: 1.5; }
                .s10-close { font-family: var(--font-display); font-size: clamp(24px, 3.2vw, 40px); font-weight: 700; color: #fff; line-height: 1.05; letter-spacing: -0.03em; margin-top: 32px; }
                .s10-close em { font-style: normal; color: #777; }
                .s10-contact { display: flex; gap: 44px; border-top: 1px solid #1a1a1a; padding-top: 24px; margin-top: 28px; }
                .s10-contact-item label { display: block; font-family: var(--font-code); font-size: 10px; letter-spacing: .15em; color: #777; text-transform: uppercase; margin-bottom: 6px; }
                .s10-contact-item span { font-size: 14px; color: #fff; font-weight: 500; }
            `}</style>

            <div className="slide-logo">
                <img src="/logo white.svg" alt="Cencori Logo" style={{ width: "48px", height: "auto" }} />
            </div>
            <div className="slide-counter" id="counter">
                {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </div>

            <div className="deck">

                {/* SLIDE 1 - THE COMPANY */}
                <div className={`slide s1 ${isPrintMode || current === 0 ? "active" : ""}`}>
                    <div className="kicker">
                        <span className="chip-sm"><HIcon icon={GlobalIcon} size={15} color="#A3A3A3" /></span>
                        <span className="s1-eyebrow">Phase 1 Raise · $5M · SAFE</span>
                    </div>
                    <div className="s1-statline">
                        The sovereign AI cloud<br />
                        for <em>emerging markets.</em>
                    </div>
                    <div className="s1-thesis">
                        <HIcon icon={EarthLockIcon} size={20} color="#fff" />
                        <span><strong>Hardware-Enabled Sovereign Cloud</strong>: compliant, low-latency AI infrastructure, built in-country.</span>
                    </div>
                    <div className="s1-meta">
                        <div className="s1-meta-item"><label>Raising</label><span>$5,000,000</span></div>
                        <div className="s1-meta-item"><label>Instrument</label><span>SAFE</span></div>
                        <div className="s1-meta-item"><label>CEO</label><span>Bola Roy Banjo</span></div>
                        <div className="s1-meta-item"><label>COO</label><span>Oreofe Ojurereoluwa Daniel</span></div>
                    </div>
                </div>

                {/* SLIDE 2 - THE BELIEF */}
                <div className={`slide s2 ${isPrintMode || current === 1 ? "active" : ""}`}>
                    <div className="s2-left">
                        <div className="kicker">
                            <span className="chip-sm light"><HIcon icon={EarthLockIcon} size={15} color="#000" /></span>
                            <span className="eyebrow">The Belief</span>
                        </div>
                        <div className="s2-answer">"What fundamental truth do we believe that others underestimate?"</div>
                        <div className="s2-statement">AI will not run forever on borrowed infrastructure. The next era of emerging-market AI has to be sovereign: hosted, governed, and priced at home.</div>
                        <div className="big-quote">"You cannot regulate data you do not hold."</div>
                    </div>
                    <div className="s2-right">
                        <div className="s2-conviction">What most people miss</div>
                        <div className="s2-belief-item">
                            <HIcon icon={CloudIcon} size={18} color="#000" style={{ marginTop: 2, flexShrink: 0 }} />
                            <div className="s2-belief-text"><strong>Software alone hits a wall.</strong> Pure-software AI in emerging markets still runs on foreign clouds, exposed to FX, egress fees, and now regulation. The foundation has to be physical.</div>
                        </div>
                        <div className="s2-belief-item">
                            <HIcon icon={JusticeScale01Icon} size={18} color="#000" style={{ marginTop: 2, flexShrink: 0 }} />
                            <div className="s2-belief-text"><strong>Regulation is forcing the shift.</strong> The CBN 2027 mandate makes local data residency the law, not a preference. Every Nigerian financial institution must localize by January 1, 2027.</div>
                        </div>
                        <div className="s2-belief-item">
                            <HIcon icon={Layers01Icon} size={18} color="#000" style={{ marginTop: 2, flexShrink: 0 }} />
                            <div className="s2-belief-text"><strong>Whoever owns the sovereign layer owns the market.</strong> Control compliant, in-country AI infrastructure and you become the default for finance, health, agriculture, and government.</div>
                        </div>
                        <div className="s2-belief-item">
                            <HIcon icon={ServerStack01Icon} size={18} color="#000" style={{ marginTop: 2, flexShrink: 0 }} />
                            <div className="s2-belief-text"><strong>Cencori is building that layer.</strong> Not foreign racks rented locally: a vertically integrated, hardware-enabled sovereign cloud, starting in Lagos.</div>
                        </div>
                    </div>
                </div>

                {/* SLIDE 3 - THE PROBLEM */}
                <div className={`slide s3 ${isPrintMode || current === 2 ? "active" : ""}`}>
                    <div className="kicker">
                        <span className="chip-sm"><HIcon icon={JusticeScale01Icon} size={15} color="#A3A3A3" /></span>
                        <span className="eyebrow-dark">The Problem</span>
                    </div>
                    <div className="s3-headline">Emerging-market AI is trapped between<br />a cloud tax and a compliance wall.</div>
                    <div className="problem-grid">
                        <div className="problem-item">
                            <span className="chip"><HIcon icon={Coins01Icon} size={20} color="#fff" /></span>
                            <div className="problem-num">01</div>
                            <div className="problem-title">The Cloud Tax</div>
                            <div className="problem-desc">Enterprises run on AWS, Azure, and GCP, paying dollar-denominated egress and bandwidth fees, fully exposed to FX swings. Capital flight, every single month.</div>
                        </div>
                        <div className="problem-item">
                            <span className="chip"><HIcon icon={JusticeScale01Icon} size={20} color="#fff" /></span>
                            <div className="problem-num">02</div>
                            <div className="problem-title">The Compliance Wall</div>
                            <div className="problem-desc">CBN 2027 legally bars financial institutions from processing sensitive citizen and transaction data on foreign cloud. Localize in-country, or operate illegally.</div>
                        </div>
                        <div className="problem-item">
                            <span className="chip"><HIcon icon={CpuIcon} size={20} color="#fff" /></span>
                            <div className="problem-num">03</div>
                            <div className="problem-title">The Compute Chokehold</div>
                            <div className="problem-desc">Local banks, startups, and researchers are priced and latency-locked out of high-performance GPUs. Standard data centers are CPU-built; they can't run modern AI.</div>
                        </div>
                    </div>
                    <div className="s3-result">
                        <div className="s3-result-label">The result</div>
                        <div className="s3-result-list">
                            <div className="s3-result-item"><HIcon icon={ExchangeDollarIcon} size={16} color="#A3A3A3" /><span><strong>Capital flight</strong>: value leaving the region</span></div>
                            <div className="s3-result-item"><HIcon icon={Calendar03Icon} size={16} color="#A3A3A3" /><span><strong>Regulatory exposure</strong>: a 2027 deadline counting down</span></div>
                            <div className="s3-result-item"><HIcon icon={CpuIcon} size={16} color="#A3A3A3" /><span><strong>An innovation ceiling</strong>: a region locked out of AI</span></div>
                        </div>
                    </div>
                </div>

                {/* SLIDE 4 - THE SOLUTION */}
                <div className={`slide s4 ${isPrintMode || current === 3 ? "active" : ""}`}>
                    <div className="kicker">
                        <span className="chip-sm light"><ShapesIcon fill="#000" width={15} height={15} /></span>
                        <span className="eyebrow">The Solution</span>
                    </div>
                    <div className="headline-dark">One sovereign stack. Two engines.</div>
                    <div className="s4-subhead">Enterprise-grade hardware, co-located in Lagos, split into two market offerings on a single physical stack, with hardware-enforced isolation between them.</div>
                    <div className="engines-grid">
                        <div className="engine-card featured">
                            <div className="engine-head">
                                <span className="chip"><HIcon icon={BankIcon} size={20} color="#fff" /></span>
                                <div>
                                    <div className="engine-card-label">The Anchor</div>
                                    <div className="engine-card-title">Cencori Enterprise</div>
                                </div>
                            </div>
                            <div className="engine-list">
                                <div className="eng-li"><CheckIcon fill="#fff" width={12} height={12} /> CPU-driven core ledgers</div>
                                <div className="eng-li"><CheckIcon fill="#fff" width={12} height={12} /> Localized NVMe data storage</div>
                                <div className="eng-li"><CheckIcon fill="#fff" width={12} height={12} /> Real-time, in-country AI workloads</div>
                                <div className="eng-li"><CheckIcon fill="#fff" width={12} height={12} /> 100% CBN-2027 compliant</div>
                            </div>
                        </div>
                        <div className="engine-card">
                            <div className="engine-head">
                                <span className="chip light"><HIcon icon={AiChipIcon} size={20} color="#000" /></span>
                                <div>
                                    <div className="engine-card-label">The Volume</div>
                                    <div className="engine-card-title">Cencori Compute</div>
                                </div>
                            </div>
                            <div className="engine-list">
                                <div className="eng-li"><CheckIcon fill="#000" width={12} height={12} /> On-demand / serverless GPU pools</div>
                                <div className="eng-li"><CheckIcon fill="#000" width={12} height={12} /> Distributed ML model training</div>
                                <div className="eng-li"><CheckIcon fill="#000" width={12} height={12} /> The AI gateway, live today</div>
                                <div className="eng-li"><CheckIcon fill="#000" width={12} height={12} /> Naira-backed, pay-as-you-go billing</div>
                            </div>
                        </div>
                    </div>
                    <div className="isolation-grid">
                        <div className="isolation-item">
                            <div className="isolation-head"><HIcon icon={ChipIcon} size={17} color="#000" /><div className="isolation-title">Silicon Isolation</div></div>
                            <div className="isolation-desc">NVIDIA MIG + SR-IOV slice each GPU and CPU into physically isolated hardware slots.</div>
                        </div>
                        <div className="isolation-item">
                            <div className="isolation-head"><HIcon icon={Key01Icon} size={17} color="#000" /><div className="isolation-title">Data Separation</div></div>
                            <div className="isolation-desc">Enterprise data on dedicated NVMe, encrypted with on-silicon AES-256 keys held by the client.</div>
                        </div>
                        <div className="isolation-item">
                            <div className="isolation-head"><HIcon icon={Shield01Icon} size={17} color="#000" /><div className="isolation-title">Network Perimeter</div></div>
                            <div className="isolation-desc">Bank traffic bypasses the public internet via private cross-connect into isolated VPCs.</div>
                        </div>
                    </div>
                </div>

                {/* SLIDE 5 - WHY NOW */}
                <div className={`slide s5 ${isPrintMode || current === 4 ? "active" : ""}`}>
                    <div className="kicker">
                        <span className="chip-sm"><HIcon icon={Calendar03Icon} size={15} color="#A3A3A3" /></span>
                        <span className="eyebrow-dark">Why Now</span>
                    </div>
                    <div className="headline-light">The clock is the catalyst: January 1, 2027.</div>
                    <div className="body-light" style={{ maxWidth: "640px", marginBottom: "32px" }}>The Central Bank of Nigeria's data-localization mandate requires every financial institution to host and process local transaction data inside the country's borders. A hard, dated, non-optional deadline, and the migration window is open now.</div>
                    <div className="timeline-eras">
                        <div className="timeline-era">
                            <div className="timeline-era-head"><HIcon icon={CloudIcon} size={18} color="#A3A3A3" /><div className="timeline-era-label">Today</div></div>
                            <div className="timeline-era-title">Non-Compliant by Default</div>
                            <div className="timeline-era-desc">Banks run sensitive workloads on foreign cloud, exposed to FX, egress, and a regulation they can't yet meet.</div>
                        </div>
                        <div className="timeline-era">
                            <div className="timeline-era-head"><HIcon icon={JusticeScale01Icon} size={18} color="#A3A3A3" /><div className="timeline-era-label">Jan 1, 2027</div></div>
                            <div className="timeline-era-title">Mandate in Force</div>
                            <div className="timeline-era-desc">Local data residency becomes law. Localize, or face regulatory action.</div>
                        </div>
                        <div className="timeline-era future">
                            <div className="timeline-era-head"><HIcon icon={Clock01Icon} size={18} color="#fff" /><div className="timeline-era-label">The Window</div></div>
                            <div className="timeline-era-title">12-18 Months</div>
                            <div className="timeline-era-desc">Whoever is compliant-ready first wins the banks. That window is open right now.</div>
                        </div>
                    </div>
                    <div className="s5-proofs">
                        <div className="s5-proof"><HIcon icon={JusticeScale01Icon} size={22} color="#fff" /><div className="s5-proof-text">CBN 2027: a deadline written into law</div></div>
                        <div className="s5-proof"><HIcon icon={ExchangeDollarIcon} size={22} color="#fff" /><div className="s5-proof-text">Cloud tax + FX: a cost banks feel monthly</div></div>
                        <div className="s5-proof"><HIcon icon={CpuIcon} size={22} color="#fff" /><div className="s5-proof-text">GPU lockout: real, unmet local demand</div></div>
                        <div className="s5-proof"><HIcon icon={ConnectIcon} size={22} color="#fff" /><div className="s5-proof-text">Live gateway + 350 devs: we already ship</div></div>
                        <div className="s5-proof"><Anthropic size={22} /><div className="s5-proof-text">Anthropic partnership: structural credibility</div></div>
                    </div>
                </div>

                {/* SLIDE 6 - TRACTION */}
                <div className={`slide s6 ${isPrintMode || current === 5 ? "active" : ""}`}>
                    <div className="kicker">
                        <span className="chip-sm light"><HIcon icon={Rocket01Icon} size={15} color="#000" /></span>
                        <span className="eyebrow">Traction</span>
                    </div>
                    <div className="headline-dark">We built the software half<br />before raising a dollar.</div>
                    <div className="body-dark" style={{ maxWidth: "660px" }}>The gateway is live and developers are building on it: proof this team ships production infrastructure. This raise builds the sovereign hardware layer beneath it.</div>
                    <div className="traction-grid">
                        <div className="traction-item">
                            <div className="traction-icon"><HIcon icon={UserGroupIcon} size={24} color="#000" /></div>
                            <div className="traction-big">350+</div>
                            <div className="traction-label">Developers onboarded,<br />zero paid marketing</div>
                        </div>
                        <div className="traction-item">
                            <div className="traction-icon"><HIcon icon={ConnectIcon} size={24} color="#000" /></div>
                            <div className="traction-big">LIVE</div>
                            <div className="traction-label">Production AI gateway,<br />dashboard & SDKs</div>
                        </div>
                        <div className="traction-item">
                            <div className="traction-icon"><Anthropic size={24} /></div>
                            <div className="traction-big" style={{ fontSize: "26px" }}>Partner</div>
                            <div className="traction-label">Official <strong>Anthropic</strong><br />partnership</div>
                        </div>
                        <div className="traction-item">
                            <div className="traction-icon"><HIcon icon={SourceCodeIcon} size={24} color="#000" /></div>
                            <div className="traction-big" style={{ fontSize: "26px" }}>TS·PY·GO</div>
                            <div className="traction-label">Native SDKs across<br />three languages</div>
                        </div>
                    </div>
                    <div className="traction-note">
                        <HIcon icon={Configuration01Icon} size={22} color="#000" style={{ flexShrink: 0, marginTop: 1 }} />
                        <div className="traction-note-text">
                            <strong>Zero institutional capital. Zero paid marketing.</strong> The founding team shipped a live AI gateway, multiple SDKs, and an Anthropic partnership before asking for a dollar. The banks, the GPUs, and the Lagos node are not claims; they are exactly what this raise goes to build.
                        </div>
                    </div>
                </div>

                {/* SLIDE 7 - GO-TO-MARKET */}
                <div className={`slide s7 ${isPrintMode || current === 6 ? "active" : ""}`}>
                    <div className="kicker">
                        <span className="chip-sm"><HIcon icon={Exchange01Icon} size={15} color="#A3A3A3" /></span>
                        <span className="eyebrow-dark">Go-to-Market</span>
                    </div>
                    <div className="headline-light">Anchor the banks. Fund the builders.</div>
                    <div className="body-light" style={{ maxWidth: "640px", marginBottom: "8px" }}>Enterprise contracts with financial institutions underwrite the infrastructure, which lets us offer the cheapest sovereign GPU compute in the region, pulling in the next thousand builders.</div>
                    <div className="gtm-grid">
                        <div className="gtm-half">
                            <div className="gtm-half-head">
                                <span className="chip"><HIcon icon={BankIcon} size={20} color="#fff" /></span>
                                <div>
                                    <div className="gtm-half-label">The Anchor · Planned</div>
                                    <div className="gtm-half-title">Enterprise</div>
                                </div>
                            </div>
                            <div className="gtm-list">
                                <div className="gtm-list-item"><HIcon icon={Agreement01Icon} size={15} color="#fff" style={{ flexShrink: 0, marginTop: 1 }} />Target: 3-5 Tier-1 financial institutions</div>
                                <div className="gtm-list-item"><HIcon icon={SecurityCheckIcon} size={15} color="#fff" style={{ flexShrink: 0, marginTop: 1 }} />Wedge: CBN-2027 compliance, ready before the deadline</div>
                                <div className="gtm-list-item"><HIcon icon={Coins01Icon} size={15} color="#fff" style={{ flexShrink: 0, marginTop: 1 }} />$25K implementation + $15-30K / month recurring</div>
                                <div className="gtm-list-item"><HIcon icon={Rocket01Icon} size={15} color="#fff" style={{ flexShrink: 0, marginTop: 1 }} />This raise funds acquisition of the first anchor clients</div>
                                <div className="gtm-list-item"><HIcon icon={Exchange01Icon} size={15} color="#fff" style={{ flexShrink: 0, marginTop: 1 }} />Absorbs the Lagos node CapEx in 18-24 months</div>
                            </div>
                        </div>
                        <div className="gtm-half">
                            <div className="gtm-half-head">
                                <span className="chip"><HIcon icon={SourceCodeIcon} size={20} color="#fff" /></span>
                                <div>
                                    <div className="gtm-half-label">The Volume · Live</div>
                                    <div className="gtm-half-title">Developers</div>
                                </div>
                            </div>
                            <div className="gtm-list">
                                <div className="gtm-list-item"><HIcon icon={AiChipIcon} size={15} color="#fff" style={{ flexShrink: 0, marginTop: 1 }} />Pay-as-you-go GPU + AI gateway, live today</div>
                                <div className="gtm-list-item"><HIcon icon={UserGroupIcon} size={15} color="#fff" style={{ flexShrink: 0, marginTop: 1 }} />350+ developers onboarded, zero marketing spend</div>
                                <div className="gtm-list-item"><HIcon icon={Coins01Icon} size={15} color="#fff" style={{ flexShrink: 0, marginTop: 1 }} />Naira-backed billing, no FX friction</div>
                                <div className="gtm-list-item"><HIcon icon={ConnectIcon} size={15} color="#fff" style={{ flexShrink: 0, marginTop: 1 }} />Integrate in minutes: SDKs, OpenAPI, playground</div>
                                <div className="gtm-list-item"><HIcon icon={Rocket01Icon} size={15} color="#fff" style={{ flexShrink: 0, marginTop: 1 }} />Low entry barrier drives long-tail volume</div>
                            </div>
                        </div>
                    </div>
                    <div className="gtm-bridge">
                        <HIcon icon={Exchange01Icon} size={22} color="#fff" style={{ flexShrink: 0, marginTop: 1 }} />
                        <div className="gtm-bridge-text">
                            <strong>The flywheel:</strong> 3-5 anchor banks fund the Lagos node, which lets us drop the price of sovereign compute for hundreds of local startups, building a captive, multi-industry ecosystem. Enterprise pays for the metal; developers compound the moat.
                        </div>
                    </div>
                </div>

                {/* SLIDE 8 - MARKET OPPORTUNITY */}
                <div className={`slide s8 ${isPrintMode || current === 7 ? "active" : ""}`}>
                    <div className="kicker">
                        <span className="chip-sm light"><BarChartIcon fill="#000" width={15} height={15} /></span>
                        <span className="eyebrow">Market Opportunity</span>
                    </div>
                    <div className="headline-dark">Win finance first. Then spill into<br />every regulated industry.</div>
                    <div className="body-dark" style={{ maxWidth: "640px" }}>Conquering the most scrutinized sector, banking, validates the compliance and performance stack, clearing a path into adjacent high-value verticals across the region.</div>
                    <div className="vert-box">
                        <div className="vert-row">
                            <div className="vert-name-cell"><span className="chip-sm light"><HIcon icon={BankIcon} size={15} color="#000" /></span><div><div className="vert-name">Finance</div><span className="vert-stage">Anchor</span></div></div>
                            <div className="vert-value">Regulatory sovereignty & Naira predictability</div>
                            <div className="vert-use">Transaction ledgers, settlement, live fraud scoring</div>
                        </div>
                        <div className="vert-row">
                            <div className="vert-name-cell"><span className="chip-sm light"><HIcon icon={Hospital01Icon} size={15} color="#000" /></span><div><div className="vert-name">Healthcare</div><span className="vert-stage">Horizon 1</span></div></div>
                            <div className="vert-value">Compliant patient-data residency</div>
                            <div className="vert-use">X-ray & MRI ML diagnostics, health records</div>
                        </div>
                        <div className="vert-row">
                            <div className="vert-name-cell"><span className="chip-sm light"><HIcon icon={Plant01Icon} size={15} color="#000" /></span><div><div className="vert-name">Agriculture</div><span className="vert-stage">Horizon 2</span></div></div>
                            <div className="vert-value">Edge processing & low-bandwidth aggregation</div>
                            <div className="vert-use">Drone/satellite mapping, soil sensors, yield prediction</div>
                        </div>
                        <div className="vert-row">
                            <div className="vert-name-cell"><span className="chip-sm light"><HIcon icon={CourtHouseIcon} size={15} color="#000" /></span><div><div className="vert-name">Government</div><span className="vert-stage">Horizon 3</span></div></div>
                            <div className="vert-value">National identity & security infrastructure</div>
                            <div className="vert-use">NIN/BVN registry, municipal AI automation</div>
                        </div>
                    </div>
                    <div className="econ-box">
                        <div className="econ-row"><span>3-5 anchor banks × ~$240K / year</span><strong>~$0.7M to $1.2M ARR</strong></div>
                        <div className="econ-row"><span>+ Cencori Compute (developer GPU volume)</span><strong>scales on top</strong></div>
                        <div className="econ-row"><span>Lagos node: CapEx + OpEx to go live</span><strong>~$4.4M</strong></div>
                        <div className="econ-row total"><span>Anchor revenue absorbs the node in</span><span>18-24 months</span></div>
                    </div>
                    <div className="econ-caption">Then replicate the unit across Abuja, Johannesburg, Nairobi, Cairo & Accra. Illustrative projections, not guarantees.</div>
                </div>

                {/* SLIDE 9 - TEAM */}
                <div className={`slide s9 ${isPrintMode || current === 8 ? "active" : ""}`}>
                    <div className="s9-left">
                        <div className="kicker">
                            <span className="chip-sm light"><HIcon icon={UserGroupIcon} size={15} color="#000" /></span>
                            <span className="eyebrow">The Team</span>
                        </div>
                        <div className="headline-dark" style={{ fontSize: "clamp(26px,3.2vw,40px)" }}>Operators who shipped<br />before fundraising.</div>
                        <div className="body-dark">Everything on the previous slides was built by this founding team before raising a dollar: the live gateway, the SDKs, the partnership.</div>
                        <div className="team-member">
                            <img src="/roy.png" alt="Bola Roy Banjo" className="team-avatar" />
                            <div className="team-info">
                                <div className="team-name">Bola Roy Banjo</div>
                                <div className="team-title">CEO & Co-founder</div>
                                <div className="team-bio">Built Cencori from zero to a production-grade AI gateway, billing, dashboard, and SDKs. A BSc Mechanical Engineering foundation brings a systems-and-hardware mind to AI infrastructure from first principles: exactly what a vertically integrated, hardware-enabled cloud demands.</div>
                            </div>
                        </div>
                        <hr className="team-divider" />
                        <div className="team-member">
                            <img src="/daniel-avatar.png" alt="Oreofe Ojurereoluwa Daniel" className="team-avatar" />
                            <div className="team-info">
                                <div className="team-name">Oreofe Ojurereoluwa Daniel</div>
                                <div className="team-title">COO & Co-founder</div>
                                <div className="team-bio">Owns operations and business infrastructure: compliance frameworks, vendor and facility negotiations, partnership pipelines, and the operational discipline to stand up a co-located node and onboard regulated clients.</div>
                            </div>
                        </div>
                    </div>
                    <div className="s9-right">
                        <div className="kicker">
                            <span className="chip-sm light"><HIcon icon={CheckmarkBadge01Icon} size={15} color="#000" /></span>
                            <span className="eyebrow">Why This Team Wins</span>
                        </div>
                        <div className="s9-stat">
                            <HIcon icon={CheckmarkBadge01Icon} size={20} color="#000" style={{ flexShrink: 0, marginTop: 1 }} />
                            <div><div className="s9-stat-label">Proof</div><div className="s9-stat-text"><strong>A live gateway, 350+ developers, and an Anthropic partnership, built with zero institutional capital.</strong> This team executes under constraint. Resourced, it builds at the pace of a funded company.</div></div>
                        </div>
                        <div className="s9-stat">
                            <HIcon icon={ChipIcon} size={20} color="#000" style={{ flexShrink: 0, marginTop: 1 }} />
                            <div><div className="s9-stat-label">Systems</div><div className="s9-stat-text"><strong>Hardware is not a pivot; it's the thesis.</strong> A mechanical-engineering foundation makes the co-located, silicon-isolated infrastructure roadmap a natural extension of how this team already thinks.</div></div>
                        </div>
                        <div className="s9-stat" style={{ marginBottom: 0 }}>
                            <HIcon icon={EarthLockIcon} size={20} color="#000" style={{ flexShrink: 0, marginTop: 1 }} />
                            <div><div className="s9-stat-label">Conviction</div><div className="s9-stat-text"><strong>Building the sovereign cloud for the intelligence era.</strong> Not a feature, not a wrapper: the compliant infrastructure layer an entire region will be required to run on.</div></div>
                        </div>
                    </div>
                </div>

                {/* SLIDE 10 - THE ASK */}
                <div className={`slide s10 ${isPrintMode || current === 9 ? "active" : ""}`}>
                    <div className="kicker">
                        <span className="chip-sm"><HIcon icon={Rocket01Icon} size={15} color="#A3A3A3" /></span>
                        <span className="eyebrow-dark">The Ask</span>
                    </div>
                    <div className="headline-light">$5M to bring the Lagos node live.</div>
                    <div className="ask-grid">
                        <div className="ask-cell featured">
                            <div className="ask-label dark">Raising</div>
                            <div className="ask-value dark">$5,000,000</div>
                            <div className="ask-value-sub dark">Phase 1 · SAFE</div>
                        </div>
                        <div className="ask-cell">
                            <div className="ask-label">Deployment</div>
                            <div className="ask-value" style={{ fontSize: "28px" }}>The Lagos Node</div>
                            <div className="ask-value-sub">Self-contained, replicable unit of execution</div>
                        </div>
                        <div className="ask-cell" style={{ gridColumn: "span 2" }}>
                            <div className="ask-label">Use of Funds</div>
                            <table className="funds-table">
                                <tbody>
                                    <tr><td><div className="funds-cell"><HIcon icon={CpuIcon} size={16} color="#9a9a9a" />Hardware procurement: NVIDIA GPUs, multi-core CPUs, NVMe</div></td><td className="funds-amt">$2.0M · 40%</td></tr>
                                    <tr><td><div className="funds-cell"><HIcon icon={Configuration01Icon} size={16} color="#9a9a9a" />Core software engineering: kernel hardening, hypervisors, runway</div></td><td className="funds-amt">$1.2M · 24%</td></tr>
                                    <tr><td><div className="funds-cell"><HIcon icon={UserGroupIcon} size={16} color="#9a9a9a" />Operating runway and team: first key hires, extended runway</div></td><td className="funds-amt">$600K · 12%</td></tr>
                                    <tr><td><div className="funds-cell"><HIcon icon={Shield01Icon} size={16} color="#9a9a9a" />Capital buffer: FX protection & spare inventory</div></td><td className="funds-amt">$450K · 9%</td></tr>
                                    <tr><td><div className="funds-cell"><HIcon icon={DeliveryTruck01Icon} size={16} color="#9a9a9a" />Logistics & compliance: freight, port clearing, import duties</div></td><td className="funds-amt">$400K · 8%</td></tr>
                                    <tr><td><div className="funds-cell"><HIcon icon={Building06Icon} size={16} color="#9a9a9a" />Facility operations: Tier III+ co-lo, power, interconnects</div></td><td className="funds-amt">$350K · 7%</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="s10-milestones">
                        <div className="s10-milestone">
                            <div className="s10-milestone-month">Month 1-6</div>
                            <div className="s10-milestone-text">Hardware procured · co-location secured · gateway scaled</div>
                        </div>
                        <div className="s10-milestone">
                            <div className="s10-milestone-month">Month 6-12</div>
                            <div className="s10-milestone-text">First anchor bank live on the compliant stack · CBN-ready</div>
                        </div>
                        <div className="s10-milestone">
                            <div className="s10-milestone-month">Month 12-18</div>
                            <div className="s10-milestone-text">3-5 anchor banks · node cash-flow positive · Compute GA</div>
                        </div>
                        <div className="s10-milestone">
                            <div className="s10-milestone-month">Month 18-24</div>
                            <div className="s10-milestone-text">Self-funding · Pan-African node #2 in planning</div>
                        </div>
                    </div>
                    <div className="s10-close">
                        We are building the sovereign AI cloud<br />for <em>emerging markets.</em>
                    </div>
                    <div className="s10-contact">
                        <div className="s10-contact-item"><label>Founder</label><span>Bola Roy Banjo</span></div>
                        <div className="s10-contact-item"><label>Email</label><span>bola@cencori.com</span></div>
                        <div className="s10-contact-item"><label>Website</label><span>cencori.com</span></div>
                        <div className="s10-contact-item"><label>Round</label><span>$5M Phase 1 · SAFE</span></div>
                    </div>
                </div>

            </div>

            <div className="nav">
                <button className="nav-btn" onClick={() => navigate(-1)}>← PREV</button>
                <div className="nav-dots">
                    {[...Array(total)].map((_, i) => (
                        <div key={i} className={`dot ${current === i ? "active" : ""}`} onClick={() => goTo(i)} />
                    ))}
                </div>
                <button className="nav-btn" onClick={() => navigate(1)}>NEXT →</button>
            </div>

            {!isPrintMode && (
                <button className="export-btn" onClick={downloadPDF}>
                    DOWNLOAD
                </button>
            )}
            </div>
        </>
    );
}

export default function PitchDeckPage() {
    return (
        <Suspense fallback={<div style={{ background: "#000", width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#A3A3A3", fontFamily: "var(--font-mono), ui-monospace, monospace", fontSize: "11px", letterSpacing: ".2em", textTransform: "uppercase" }}>Loading deck…</div>}>
            <PitchDeckContent />
        </Suspense>
    );
}
