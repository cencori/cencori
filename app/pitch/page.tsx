"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Script from "next/script";
import { Anthropic } from "@lobehub/icons";

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
                    Our tech is too dense and too important for a quick thumb-scroll while you're in an Uber. Please open this link on your desktop to review the full technical roadmap.
                </div>
            </div>
            
            <div className="pitch-deck-container">
            <Script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js" strategy="afterInteractive" />
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@300;400;500&display=swap');

                .pitch-deck-container {
                    --black: #000000;
                    --white: #FFFFFF;
                    --muted: #A3A3A3;
                    --muted-light: #D4D4D4;
                    --border: #262626;
                    --border-light: #E5E5E5;
                    --accent: #FFFFFF;
                    
                    width: 100vw;
                    height: 100vh;
                    background: #000;
                    font-family: 'DM Sans', sans-serif;
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
                    font-family: 'Playfair Display', serif;
                    font-size: 28px;
                    font-weight: 500;
                    color: #fff;
                    line-height: 1.3;
                    margin-bottom: 24px;
                    font-style: italic;
                }

                .mobile-wall-sub {
                    font-family: 'DM Mono', monospace;
                    font-size: 10px;
                    letter-spacing: 0.1em;
                    color: #A3A3A3;
                    line-height: 1.8;
                    max-width: 240px;
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
                .nav-btn { background: none; border: 1px solid #333; color: #A3A3A3; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .1em; padding: 6px 14px; cursor: pointer; transition: all .2s; }
                .nav-btn:hover { border-color: #fff; color: #fff; }

                .export-btn { position: fixed; bottom: 36px; right: 40px; z-index: 10001; background: none; border: 1px solid #222; color: #555; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: .15em; text-transform: uppercase; padding: 6px 14px; cursor: pointer; transition: all .2s; }
                .export-btn:hover { border-color: #fff; color: #fff; }

                @media print {
                    html, body { width: 100%; height: auto; overflow: visible !important; background: #fff; }
                    .deck { width: 100%; height: auto; position: static; }
                    .slide { position: relative !important; display: flex !important; width: 100vw; height: 100vh; page-break-after: always; break-after: page; overflow: hidden; }
                    .slide.active { display: flex !important; }
                    .nav, .slide-counter, .slide-logo, .export-btn { display: none !important; }
                    @page { size: landscape; margin: 0; }
                }

                .slide-counter { position: fixed; top: 28px; right: 40px; font-family: 'DM Mono', monospace; font-size: 11px; color: #444; letter-spacing: .1em; z-index: 10000; }
                .slide-logo { position: fixed; top: 28px; left: 40px; z-index: 10000; }

                /* SHARED */
                .eyebrow { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #737373; text-transform: uppercase; margin-bottom: 24px; }
                .eyebrow-dark { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #444; text-transform: uppercase; margin-bottom: 24px; }
                .headline-dark { font-family: 'Playfair Display', serif; font-size: clamp(36px, 4vw, 56px); font-weight: 800; line-height: 1.05; color: #000; margin-bottom: 24px; }
                .headline-light { font-family: 'Playfair Display', serif; font-size: clamp(36px, 4vw, 56px); font-weight: 800; line-height: 1.05; color: #fff; margin-bottom: 24px; }
                .body-dark { font-size: 14px; color: #444; line-height: 1.75; font-weight: 300; margin-bottom: 16px; }
                .body-light { font-size: 14px; color: #737373; line-height: 1.75; font-weight: 300; margin-bottom: 16px; }
                .big-quote { font-family: 'Playfair Display', serif; font-size: clamp(24px, 3vw, 36px); font-style: italic; font-weight: 400; line-height: 1.3; color: #000; border-left: 3px solid #000; padding-left: 24px; margin: 32px 0; }

                /* SLIDE 1 — THE COMPANY */
                .s1 { background: #000; flex-direction: column; justify-content: center; padding: 0 10%; }
                .s1-eyebrow { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: .2em; color: #A3A3A3; text-transform: uppercase; margin-bottom: 32px; }
                .s1-statline { font-family: 'Playfair Display', serif; font-size: clamp(42px, 6vw, 80px); font-weight: 800; line-height: 1.05; color: #fff; margin-bottom: 48px; max-width: 1200px; }
                .s1-statline em { font-style: italic; color: #A3A3A3; }
                .s1-thesis { font-size: 16px; color: #A3A3A3; font-weight: 300; letter-spacing: .05em; margin-bottom: 16px; }
                .s1-thesis strong { color: #fff; font-weight: 500; }
                .s1-meta { display: flex; gap: 48px; border-top: 1px solid #262626; padding-top: 32px; }
                .s1-meta-item label { display: block; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .15em; color: #888; text-transform: uppercase; margin-bottom: 6px; }
                .s1-meta-item span { font-size: 14px; color: #fff; font-weight: 500; }

                /* SLIDE 2 — THE BELIEF */
                .s2 { background: #fff; flex-direction: row; }
                .s2-left { width: 55%; padding: 8% 5% 8% 10%; display: flex; flex-direction: column; justify-content: center; }
                .s2-right { width: 45%; padding: 8% 10% 8% 5%; border-left: 1px solid #e5e5e5; display: flex; flex-direction: column; justify-content: center; }
                .s2-conviction { font-family: 'Playfair Display', serif; font-size: clamp(20px, 2.5vw, 32px); font-weight: 700; line-height: 1.2; color: #000; margin-bottom: 24px; }
                .s2-answer { font-family: 'DM Mono', monospace; font-size: 11px; color: #737373; letter-spacing: .1em; margin-bottom: 32px; }
                .s2-belief-item { padding: 16px 0; border-bottom: 1px solid #f0f0f0; }
                .s2-belief-item:last-child { border-bottom: none; }
                .s2-belief-text { font-size: 14px; color: #333; line-height: 1.6; font-weight: 300; }
                .s2-belief-text strong { color: #000; font-weight: 600; }
                .s2-statement { font-family: 'Playfair Display', serif; font-size: clamp(20px, 2.5vw, 34px); font-style: italic; font-weight: 700; color: #000; line-height: 1.2; }

                /* SLIDE 3 — THE PROBLEM */
                .s3 { background: #000; flex-direction: column; justify-content: center; padding: 0 10%; }
                .s3-headline { font-family: 'Playfair Display', serif; font-size: clamp(36px, 4vw, 56px); font-weight: 800; line-height: 1.05; color: #fff; margin-bottom: 36px; }
                .problem-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #1a1a1a; border: 1px solid #1a1a1a; }
                .problem-item { background: #000; padding: 28px 24px; }
                .problem-icon { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #555; margin-bottom: 12px; text-transform: uppercase; }
                .problem-title { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 8px; }
                .problem-desc { font-size: 12px; color: #A3A3A3; line-height: 1.6; font-weight: 300; }
                .s3-result { border: 1px solid #1a1a1a; margin-top: 32px; padding: 24px 32px; display: flex; align-items: center; gap: 40px; }
                .s3-result-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #555; text-transform: uppercase; white-space: nowrap; }
                .s3-result-list { display: flex; gap: 32px; }
                .s3-result-item { font-size: 13px; color: #A3A3A3; }
                .s3-result-item strong { color: #fff; font-weight: 500; }

                /* SLIDE 4 — THE SOLUTION */
                .s4 { background: #fff; flex-direction: column; justify-content: center; padding: 0 10%; }
                .s4-subhead { font-size: 14px; color: #737373; font-weight: 300; margin-bottom: 36px; max-width: 600px; }
                .solution-flow { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0; margin-bottom: 40px; border: 1px solid #e5e5e5; }
                .solution-flow-item { padding: 20px 16px; text-align: center; border-right: 1px solid #e5e5e5; background: #fff; }
                .solution-flow-item:last-child { border-right: none; }
                .solution-flow-item.featured { background: #000; }
                .solution-flow-item.featured .solution-flow-label { color: #fff; }
                .solution-flow-item.featured .solution-flow-desc { color: #A3A3A3; }
                .solution-flow-label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: .15em; color: #000; text-transform: uppercase; margin-bottom: 8px; font-weight: 500; }
                .solution-flow-desc { font-size: 10px; color: #737373; line-height: 1.5; font-weight: 300; }
                .outcomes-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px; background: #e5e5e5; border: 1px solid #e5e5e5; }
                .outcome-item { background: #fff; padding: 20px 16px; text-align: center; }
                .outcome-label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: .15em; color: #737373; text-transform: uppercase; }
                .outcome-value { font-size: 13px; color: #000; font-weight: 600; margin-top: 6px; }

                /* SLIDE 5 — WHY NOW */
                .s5 { background: #000; flex-direction: column; justify-content: center; padding: 0 10%; }
                .timeline-eras { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #1a1a1a; border: 1px solid #1a1a1a; margin-bottom: 40px; }
                .timeline-era { background: #000; padding: 28px 24px; }
                .timeline-era.future { background: #0a0a0a; border: 1px solid #333; }
                .timeline-era-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #555; text-transform: uppercase; margin-bottom: 12px; }
                .timeline-era-title { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 800; color: #fff; line-height: 1; margin-bottom: 8px; }
                .timeline-era-desc { font-size: 12px; color: #A3A3A3; line-height: 1.6; font-weight: 300; }
                .s5-proofs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px; background: #1a1a1a; border: 1px solid #1a1a1a; }
                .s5-proof { background: #000; padding: 20px 16px; text-align: center; }
                .s5-proof-icon { font-size: 20px; margin-bottom: 8px; }
                .s5-proof-text { font-size: 11px; color: #A3A3A3; font-weight: 300; line-height: 1.4; }

                /* SLIDE 6 — TRACTION */
                .s6 { background: #fff; flex-direction: column; justify-content: center; padding: 0 10%; }
                .traction-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #e5e5e5; margin: 36px 0; border: 1px solid #e5e5e5; }
                .traction-item { background: #fff; padding: 28px 24px; }
                .traction-big { font-family: 'Playfair Display', serif; font-size: 44px; font-weight: 800; color: #000; line-height: 1; margin-bottom: 8px; }
                .traction-label { font-size: 12px; color: #737373; font-weight: 300; line-height: 1.5; }
                .traction-label strong { font-weight: 700; color: #000; }
                .traction-note { border: 1px solid #e5e5e5; padding: 24px 32px; display: flex; align-items: center; gap: 32px; }
                .traction-note-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #737373; text-transform: uppercase; white-space: nowrap; }
                .traction-note-text { font-size: 13px; color: #333; font-weight: 300; line-height: 1.6; }
                .traction-note-text strong { color: #000; font-weight: 600; }

                /* SLIDE 7 — GO-TO-MARKET */
                .s7 { background: #000; flex-direction: column; justify-content: center; padding: 0 10%; }
                .gtm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #1a1a1a; border: 1px solid #1a1a1a; margin: 32px 0; }
                .gtm-half { background: #000; padding: 32px 28px; }
                .gtm-half-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #555; text-transform: uppercase; margin-bottom: 20px; }
                .gtm-half-title { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 800; color: #fff; line-height: 1; margin-bottom: 16px; }
                .gtm-list { display: flex; flex-direction: column; gap: 8px; }
                .gtm-list-item { display: flex; align-items: flex-start; gap: 12px; font-size: 13px; color: #A3A3A3; font-weight: 300; }
                .gtm-list-dot { width: 5px; height: 5px; background: #fff; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
                .gtm-bridge { border: 1px solid #1a1a1a; padding: 20px 28px; display: flex; align-items: center; gap: 32px; }
                .gtm-bridge-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #555; text-transform: uppercase; white-space: nowrap; }
                .gtm-bridge-text { font-size: 13px; color: #fff; font-weight: 300; line-height: 1.5; }
                .gtm-bridge-text strong { color: #fff; font-weight: 600; }

                /* SLIDE 8 — MARKET OPPORTUNITY */
                .s8 { background: #fff; flex-direction: column; justify-content: center; padding: 0 10%; }
                .napkin-box { border: 1px solid #e5e5e5; padding: 32px; margin-top: 28px; }
                .napkin-row { display: flex; align-items: flex-start; padding: 16px 0; border-bottom: 1px solid #f0f0f0; gap: 32px; }
                .napkin-row:last-child { border-bottom: none; }
                .napkin-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #737373; text-transform: uppercase; min-width: 120px; padding-top: 4px; }
                .napkin-content { flex: 1; }
                .napkin-big { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 800; color: #000; line-height: 1; margin-bottom: 4px; }
                .napkin-sub { font-size: 12px; color: #737373; font-weight: 300; }
                .napkin-math { background: #fafafa; border: 1px solid #e5e5e5; padding: 24px 28px; margin-top: 24px; display: flex; flex-direction: column; gap: 10px; }
                .napkin-math-row { display: flex; justify-content: space-between; font-size: 13px; color: #333; font-weight: 300; }
                .napkin-math-row.total { border-top: 2px solid #000; padding-top: 12px; font-weight: 600; color: #000; font-size: 15px; }
                .napkin-math-row strong { font-weight: 600; }

                /* SLIDE 9 — TEAM */
                .s9 { background: #fff; flex-direction: row; }
                .s9-left { width: 50%; padding: 8% 5% 8% 10%; border-right: 1px solid #e5e5e5; display: flex; flex-direction: column; justify-content: center; }
                .s9-right { width: 50%; padding: 8% 10% 8% 5%; display: flex; flex-direction: column; justify-content: center; }
                .team-member { display: flex; align-items: flex-start; gap: 20px; margin-top: 20px; }
                .team-avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid #e5e5e5; }
                .team-info { flex: 1; }
                .team-name { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; color: #000; margin-bottom: 2px; }
                .team-title { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .15em; color: #737373; text-transform: uppercase; margin-bottom: 12px; }
                .team-bio { font-size: 13px; color: #555; line-height: 1.75; font-weight: 300; margin-bottom: 8px; }
                .team-divider { border: none; border-top: 1px solid #e5e5e5; margin: 20px 0; }
                .s9-stat { border: 1px solid #e5e5e5; padding: 16px 20px; display: flex; align-items: center; gap: 20px; margin-bottom: 16px; }
                .s9-stat-label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: .15em; color: #737373; text-transform: uppercase; white-space: nowrap; }
                .s9-stat-text { font-size: 13px; color: #000; font-weight: 300; line-height: 1.5; }
                .s9-stat-text strong { font-weight: 600; }

                /* SLIDE 10 — THE ASK */
                .s10 { background: #000; flex-direction: column; justify-content: center; padding: 0 10%; }
                .ask-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 1px; background: #1a1a1a; margin-top: 32px; border: 1px solid #1a1a1a; }
                .ask-cell { background: #000; padding: 28px 24px; }
                .ask-cell.featured { background: #fff; }
                .ask-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #888; text-transform: uppercase; margin-bottom: 12px; }
                .ask-label.dark { color: #737373; }
                .ask-value { font-family: 'Playfair Display', serif; font-size: 40px; font-weight: 800; color: #fff; line-height: 1; margin-bottom: 8px; }
                .ask-value.dark { color: #000; }
                .ask-value-sub { font-size: 12px; color: #A3A3A3; font-weight: 300; }
                .ask-value-sub.dark { color: #737373; }
                .funds-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
                .funds-table td { padding: 10px 0; border-bottom: 1px solid #262626; color: #A3A3A3; }
                .funds-table tr:last-child td { border-bottom: none; }
                .s10-close { font-family: 'Playfair Display', serif; font-size: clamp(28px, 4vw, 48px); font-weight: 900; color: #fff; line-height: 1; margin-top: 40px; }
                .s10-close em { font-style: italic; color: #A3A3A3; }
                .s10-contact { display: flex; gap: 48px; border-top: 1px solid #1a1a1a; padding-top: 28px; margin-top: 32px; }
                .s10-contact-item label { display: block; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .15em; color: #888; text-transform: uppercase; margin-bottom: 6px; }
                .s10-contact-item span { font-size: 14px; color: #fff; font-weight: 500; }

                .s10-milestones { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; background: #1a1a1a; border: 1px solid #1a1a1a; margin-top: 24px; }
                .s10-milestone { background: #000; padding: 20px 24px; }
                .s10-milestone-month { font-family: 'DM Mono', monospace; font-size: 10px; color: #737373; margin-bottom: 6px; }
                .s10-milestone-text { font-size: 13px; color: #fff; font-weight: 300; }
            `}</style>

            <div className="slide-logo">
                <img src="/logo white.svg" alt="Cencori Logo" style={{ width: "48px", height: "auto" }} />
            </div>
            <div className="slide-counter" id="counter">
                {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </div>

            <div className="deck">

                {/* SLIDE 1 — THE COMPANY */}
                <div className={`slide s1 ${isPrintMode || current === 0 ? "active" : ""}`}>
                    <div className="s1-eyebrow">Seed Round · $5M · SAFE</div>
                    <div className="s1-statline">
                        One stop shop to building<br />
                        the next generation of <em>AI companies.</em>
                    </div>
                    <div className="s1-thesis"><strong>The Control Layer for Production AI</strong> — Intelligence Infrastructure</div>
                    <div className="s1-meta">
                        <div className="s1-meta-item"><label>Raising</label><span>$5,000,000</span></div>
                        <div className="s1-meta-item"><label>Instrument</label><span>SAFE</span></div>
                        <div className="s1-meta-item"><label>CEO</label><span>Bola Roy Banjo</span></div>
                        <div className="s1-meta-item"><label>COO</label><span>Oreofe Ojurereoluwa Daniel</span></div>
                    </div>
                </div>

                {/* SLIDE 2 — THE BELIEF */}
                <div className={`slide s2 ${isPrintMode || current === 1 ? "active" : ""}`}>
                    <div className="s2-left">
                        <div className="eyebrow">The Belief</div>
                        <div className="s2-answer">"What fundamental truth do we believe that others underestimate?"</div>
                        <div className="s2-statement">The future is not AI applications. The future is production AI systems. And production AI systems require infrastructure.</div>
                        <div className="big-quote" style={{ marginTop: "48px" }}>"Agents fail when infrastructure fails."</div>
                    </div>
                    <div className="s2-right">
                        <div className="s2-conviction">What most people miss:</div>
                        <div className="s2-belief-item">
                            <div className="s2-belief-text"><strong>AI is moving from demo to production.</strong> Every company deploying AI today is discovering that demos are easy and production is brutally hard.</div>
                        </div>
                        <div className="s2-belief-item">
                            <div className="s2-belief-text"><strong>The infrastructure is not being built.</strong> Teams assemble routing, memory, compute, governance, and billing from separate vendors. The result is fragmentation, not a platform.</div>
                        </div>
                        <div className="s2-belief-item">
                            <div className="s2-belief-text"><strong>The winner builds the unified layer.</strong> The company that owns the control surface beneath production AI systems will define what gets built in this era — the same way AWS defined internet scale.</div>
                        </div>
                        <div className="s2-belief-item" style={{ borderBottom: "none" }}>
                            <div className="s2-belief-text"><strong>Cencori is building that layer.</strong> Not as a collection of tools. As a unified operating system for production AI.</div>
                        </div>
                    </div>
                </div>

                {/* SLIDE 3 — THE PROBLEM */}
                <div className={`slide s3 ${isPrintMode || current === 2 ? "active" : ""}`}>
                    <div className="eyebrow-dark">The Problem</div>
                    <div className="s3-headline">Every production AI team<br />is rebuilding the same infrastructure.</div>
                    <div className="problem-grid">
                        <div className="problem-item">
                            <div className="problem-icon">01</div>
                            <div className="problem-title">Routing</div>
                            <div className="problem-desc">Which provider? What happens when they go down? How do you fail over without breaking your product?</div>
                        </div>
                        <div className="problem-item">
                            <div className="problem-icon">02</div>
                            <div className="problem-title">Memory</div>
                            <div className="problem-desc">How do AI features remember context across sessions? How do users get continuity without you building a vector database?</div>
                        </div>
                        <div className="problem-item">
                            <div className="problem-icon">03</div>
                            <div className="problem-title">Governance</div>
                            <div className="problem-desc">Who secures your AI pipeline? Jailbreak detection, PII masking, audit trails — every regulated industry requires this.</div>
                        </div>
                        <div className="problem-item">
                            <div className="problem-icon">04</div>
                            <div className="problem-title">Compute</div>
                            <div className="problem-desc">Where do you run inference and training? GPU access is fragmented, expensive, and operationally complex.</div>
                        </div>
                        <div className="problem-item">
                            <div className="problem-icon">05</div>
                            <div className="problem-title">Workflow</div>
                            <div className="problem-desc">Multi-step reasoning, agent coordination, human-in-the-loop — every complex AI product needs orchestration.</div>
                        </div>
                        <div className="problem-item">
                            <div className="problem-icon">06</div>
                            <div className="problem-title">Billing</div>
                            <div className="problem-desc">How do you charge your users for AI without building a metering and invoicing engine from scratch?</div>
                        </div>
                    </div>
                    <div className="s3-result">
                        <div className="s3-result-label">The result</div>
                        <div className="s3-result-list">
                            <div className="s3-result-item"><strong>Complexity</strong> — 6+ vendors per stack</div>
                            <div className="s3-result-item"><strong>Security risk</strong> — fragmented governance</div>
                            <div className="s3-result-item"><strong>Reliability failures</strong> — fragile integrations</div>
                            <div className="s3-result-item"><strong>Vendor sprawl</strong> — 7 invoices, 7 contracts</div>
                        </div>
                    </div>
                </div>

                {/* SLIDE 4 — THE SOLUTION */}
                <div className={`slide s4 ${isPrintMode || current === 3 ? "active" : ""}`}>
                    <div className="eyebrow">The Solution</div>
                    <div className="headline-dark">The Control Layer<br />for Production AI.</div>
                    <div className="s4-subhead">Not a collection of tools. A unified operating layer that makes production AI reliable, governable, and scalable.</div>
                    <div className="solution-flow">
                        <div className="solution-flow-item featured">
                            <div className="solution-flow-label">Gateway</div>
                            <div className="solution-flow-desc">Unified routing, security, observability — 100+ models, one endpoint</div>
                        </div>
                        <div className="solution-flow-item">
                            <div className="solution-flow-label">Memory</div>
                            <div className="solution-flow-desc">Persistent context, user profiles, RAG infrastructure</div>
                        </div>
                        <div className="solution-flow-item">
                            <div className="solution-flow-label">Compute</div>
                            <div className="solution-flow-desc">GPU-backed inference, fine-tuning, and training</div>
                        </div>
                        <div className="solution-flow-item">
                            <div className="solution-flow-label">Workflow</div>
                            <div className="solution-flow-desc">Agent orchestration, multi-step reasoning, tool coordination</div>
                        </div>
                        <div className="solution-flow-item">
                            <div className="solution-flow-label">Governance</div>
                            <div className="solution-flow-desc">Jailbreak detection, audit trails, SSO, RBAC</div>
                        </div>
                        <div className="solution-flow-item">
                            <div className="solution-flow-label">Billing</div>
                            <div className="solution-flow-desc">End-user monetization, metering, rate plans</div>
                        </div>
                    </div>
                    <div className="outcomes-grid">
                        <div className="outcome-item"><div className="outcome-label">Reliability</div><div className="outcome-value">Circuit breakers, auto-failover, 99.9% uptime</div></div>
                        <div className="outcome-item"><div className="outcome-label">Governance</div><div className="outcome-value">Enterprise security pipeline in every request</div></div>
                        <div className="outcome-item"><div className="outcome-label">Scale</div><div className="outcome-value">One integration, infinite providers</div></div>
                        <div className="outcome-item"><div className="outcome-label">Cost Control</div><div className="outcome-value">Per-user metering, budgets, forecasting</div></div>
                        <div className="outcome-item"><div className="outcome-label">Speed</div><div className="outcome-value">Ship production AI in days, not months</div></div>
                    </div>
                </div>

                {/* SLIDE 5 — WHY NOW */}
                <div className={`slide s5 ${isPrintMode || current === 4 ? "active" : ""}`}>
                    <div className="eyebrow-dark">Why Now</div>
                    <div className="headline-light">The infrastructure phase of AI has begun.</div>
                    <div className="body-light" style={{ maxWidth: "600px", marginBottom: "36px" }}>Every technological era follows the same sequence. First demos. Then pilots. Then production systems at scale. That third phase requires infrastructure — and it always belongs to one company.</div>
                    <div className="timeline-eras">
                        <div className="timeline-era">
                            <div className="timeline-era-label">Past</div>
                            <div className="timeline-era-title">AI Demos</div>
                            <div className="timeline-era-desc">Chatbots, prototypes, and proof-of-concepts. Low stakes, high enthusiasm.</div>
                        </div>
                        <div className="timeline-era">
                            <div className="timeline-era-label">Present</div>
                            <div className="timeline-era-title">AI Pilots</div>
                            <div className="timeline-era-desc">Teams deploying AI into real products, discovering that infrastructure is the bottleneck.</div>
                        </div>
                        <div className="timeline-era future">
                            <div className="timeline-era-label">Future</div>
                            <div className="timeline-era-title">Production AI Systems</div>
                            <div className="timeline-era-desc">Billions of AI requests running through unified infrastructure. Reliability, governance, and scale are table stakes.</div>
                        </div>
                    </div>
                    <div className="s5-proofs">
                        <div className="s5-proof"><div className="s5-proof-icon">🤝</div><div className="s5-proof-text">Anthropic partnership — structural credibility</div></div>
                        <div className="s5-proof"><div className="s5-proof-icon">🏦</div><div className="s5-proof-text">Enterprise demand — banking adoption underway</div></div>
                        <div className="s5-proof"><div className="s5-proof-icon">🌐</div><div className="s5-proof-text">Multi-model world — no single provider dominates</div></div>
                        <div className="s5-proof"><div className="s5-proof-icon">🔐</div><div className="s5-proof-text">Governance requirements — regulation is coming</div></div>
                        <div className="s5-proof"><div className="s5-proof-icon">📈</div><div className="s5-proof-text">Market readiness — 350+ devs in 90 days, zero paid marketing</div></div>
                    </div>
                </div>

                {/* SLIDE 6 — TRACTION */}
                <div className={`slide s6 ${isPrintMode || current === 5 ? "active" : ""}`}>
                    <div className="eyebrow">Traction</div>
                    <div className="headline-dark">We built before we raised.</div>
                    <div className="body-dark" style={{ maxWidth: "640px" }}>Everything here was built without institutional capital. The product is live. Developers are using it. Enterprises are engaging. The only thing missing is fuel.</div>
                    <div className="traction-grid">
                        <div className="traction-item"><div className="traction-big">350+</div><div className="traction-label">Developers onboarded<br />in ~90 days</div></div>
                        <div className="traction-item"><div className="traction-big">LIVE</div><div className="traction-label">Production API, Dashboard,<br />SDKs (TS, Python, Go)</div></div>
                        <div className="traction-item"><div className="traction-big"><Anthropic size={32} /></div><div className="traction-label">Official Anthropic<br />partner</div></div>
                        <div className="traction-item"><div className="traction-big">🏦</div><div className="traction-label">Active engagement with<br /><strong>Tier-1 bank</strong></div></div>
                    </div>
                    <div className="traction-note">
                        <div className="traction-note-label">What This Means</div>
                        <div className="traction-note-text">
                            <strong>Zero institutional capital.</strong> Zero paid marketing. A two-person team built production infrastructure, shipped multiple products, secured a strategic partnership, and entered enterprise pipeline — all before asking for money. This is not a pre-revenue story. It is a pre-funding proof point.
                        </div>
                    </div>
                </div>

                {/* SLIDE 7 — GO-TO-MARKET */}
                <div className={`slide s7 ${isPrintMode || current === 6 ? "active" : ""}`}>
                    <div className="eyebrow-dark">Go-to-Market</div>
                    <div className="headline-light">Dual motion. One destination.</div>
                    <div className="body-light" style={{ maxWidth: "600px", marginBottom: "28px" }}>Developers find us. Enterprises buy us. The bottom-up funnel feeds the top-down revenue machine.</div>
                    <div className="gtm-grid">
                        <div className="gtm-half">
                            <div className="gtm-half-label">Bottom-Up</div>
                            <div className="gtm-half-title">Developer Adoption</div>
                            <div className="gtm-list">
                                <div className="gtm-list-item"><div className="gtm-list-dot"></div>SDKs and APIs — integrate in under 3 minutes</div>
                                <div className="gtm-list-item"><div className="gtm-list-dot"></div>Free tier — 1,000 requests/month, zero friction</div>
                                <div className="gtm-list-item"><div className="gtm-list-dot"></div>OpenAPI spec, playground, Vercel AI SDK provider</div>
                                <div className="gtm-list-item"><div className="gtm-list-dot"></div>Organic discovery — 350+ devs, zero marketing spend</div>
                                <div className="gtm-list-item"><div className="gtm-list-dot"></div>Community-led — Discord, Twitter, builder口碑</div>
                            </div>
                        </div>
                        <div className="gtm-half">
                            <div className="gtm-half-label">Top-Down</div>
                            <div className="gtm-half-title">Enterprise Revenue</div>
                            <div className="gtm-list">
                                <div className="gtm-list-item"><div className="gtm-list-dot"></div>Anthropic partnership — accelerates enterprise trust</div>
                                <div className="gtm-list-item"><div className="gtm-list-dot"></div>Tier-1 banking engagement — regulated industry wedge</div>
                                <div className="gtm-list-item"><div className="gtm-list-dot"></div>Security pipeline — jailbreak detection, PII, audit, SSO</div>
                                <div className="gtm-list-item"><div className="gtm-list-dot"></div>SOC2 in progress, ISO 27001 planned</div>
                                <div className="gtm-list-item"><div className="gtm-list-dot"></div>Design partner program — banking, healthcare, regulated</div>
                            </div>
                        </div>
                    </div>
                    <div className="gtm-bridge">
                        <div className="gtm-bridge-label">The Bridge</div>
                        <div className="gtm-bridge-text">
                            <strong>Developers become enterprise revenue.</strong> A solo dev builds on the free plan. The startup ships to production on Pro. The company grows and needs enterprise compliance. Cencori grows with them — from $0 to $200K ACV — without a sales handoff. The product is the sales motion.
                        </div>
                    </div>
                </div>

                {/* SLIDE 8 — MARKET OPPORTUNITY */}
                <div className={`slide s8 ${isPrintMode || current === 7 ? "active" : ""}`}>
                    <div className="eyebrow">Market Opportunity</div>
                    <div className="headline-dark">We can build a $100M ARR company<br />without winning the entire market.</div>
                    <div className="body-dark" style={{ maxWidth: "600px" }}>This is not a TAM exercise. This is a bottom-up belief test. Modest penetration of a real, existing market creates venture-scale outcomes.</div>
                    <div className="napkin-box">
                        <div className="napkin-row">
                            <div className="napkin-label">Target Customers</div>
                            <div className="napkin-content">
                                <div className="napkin-big">5,000</div>
                                <div className="napkin-sub">Companies globally building production AI systems — AI-native startups, mid-market, and regulated enterprises</div>
                            </div>
                        </div>
                        <div className="napkin-row">
                            <div className="napkin-label">ACV Range</div>
                            <div className="napkin-content">
                                <div className="napkin-big">$20K – $200K</div>
                                <div className="napkin-sub">Blended across subscriptions, compute usage, and billing revenue share. Platform ($5K–$60K) + Compute (2–5x platform) + Billing rev share</div>
                            </div>
                        </div>
                        <div className="napkin-row" style={{ borderBottom: "none" }}>
                            <div className="napkin-label">The Math</div>
                            <div className="napkin-content">
                                <div className="napkin-math">
                                    <div className="napkin-math-row"><span>500 mid-market teams × $20K ACV</span><span>$10M</span></div>
                                    <div className="napkin-math-row"><span>50 enterprise accounts × $200K ACV</span><span>$10M</span></div>
                                    <div className="napkin-math-row"><span>2,000 developer accounts × $2K ACV</span><span>$4M</span></div>
                                    <div className="napkin-math-row"><span>Compute & billing multiplier (2–3x)</span><span>$24M – $36M</span></div>
                                    <div className="napkin-math-row total"><strong>Realistic 5-year ARR</strong><strong>$50M – $60M</strong></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "#737373", letterSpacing: ".1em", marginTop: "24px", textAlign: "center" }}>
                        At 1% of the global AI infrastructure budget, this is a $100M+ ARR company. We don't need to win. We need to be present.
                    </div>
                </div>

                {/* SLIDE 9 — TEAM */}
                <div className={`slide s9 ${isPrintMode || current === 8 ? "active" : ""}`}>
                    <div className="s9-left">
                        <div className="eyebrow">The Team</div>
                        <div className="headline-dark" style={{ fontSize: "clamp(28px,3.5vw,44px)" }}>Built by operators<br />who shipped before fundraising.</div>
                        <div className="body-dark">Two people. One vision. Zero institutional capital. Everything shown on the previous slides was built by the two people on this page.</div>
                        <div className="team-member">
                            <img src="/roy.png" alt="Bola Roy Banjo" className="team-avatar" />
                            <div className="team-info">
                                <div className="team-name">Bola Roy Banjo</div>
                                <div className="team-title">CEO & Co-founder</div>
                                <div className="team-bio">22. BSc Mechanical Engineering. Built Cencori from zero to production-grade infrastructure — gateway, billing, dashboard, SDKs, enterprise security pipeline. Systems-level thinker who approaches AI infrastructure from first principles. Previous energy tech work attracted interest from Harvard and MIT researchers.</div>
                            </div>
                        </div>
                        <hr className="team-divider" />
                        <div className="team-member">
                            <img src="/daniel-avatar.png" alt="Oreofe Ojurereoluwa Daniel" className="team-avatar" />
                            <div className="team-info">
                                <div className="team-name">Oreofe Ojurereoluwa Daniel</div>
                                <div className="team-title">COO & Co-founder</div>
                                <div className="team-bio">Operations and business infrastructure. Architected the organizational backbone — compliance frameworks, vendor negotiations, partnership pipelines, and the operational discipline that lets a two-person team ship at the velocity of a funded startup.</div>
                            </div>
                        </div>
                    </div>
                    <div className="s9-right">
                        <div className="eyebrow">Why This Team Wins</div>
                        <div className="s9-stat">
                            <div className="s9-stat-label">Proof</div>
                            <div className="s9-stat-text"><strong>350+ developers, Anthropic partnership, bank engagement, live product — all without a dollar of institutional capital.</strong> This team builds with constraints. Give them resources and they will build at a pace that rivals any well-funded startup in the space.</div>
                        </div>
                        <div className="s9-stat">
                            <div className="s9-stat-label">Systems</div>
                            <div className="s9-stat-text"><strong>Full-stack infrastructure thinking.</strong> Bola's mechanical engineering background brings a systems-level perspective that pure software engineers miss. The hardware and robotics roadmap is a natural extension, not a pivot.</div>
                        </div>
                        <div className="s9-stat" style={{ marginBottom: 0 }}>
                            <div className="s9-stat-label">Conviction</div>
                            <div className="s9-stat-text"><strong>Immense.</strong> This team is not building a startup. They are building the infrastructure company of the intelligence era. That is not a fundraising line. It is the operating model.</div>
                        </div>
                    </div>
                </div>

                {/* SLIDE 10 — THE ASK */}
                <div className={`slide s10 ${isPrintMode || current === 9 ? "active" : ""}`}>
                    <div className="eyebrow-dark">The Ask</div>
                    <div className="headline-light">$5M to build the<br />operating layer beneath production AI.</div>
                    <div className="ask-grid">
                        <div className="ask-cell featured">
                            <div className="ask-label dark">Raising</div>
                            <div className="ask-value dark">$5,000,000</div>
                            <div className="ask-value-sub dark">Seed · SAFE</div>
                        </div>
                        <div className="ask-cell">
                            <div className="ask-label">Runway</div>
                            <div className="ask-value">20 months</div>
                            <div className="ask-value-sub">To Series A readiness</div>
                        </div>
                        <div className="ask-cell" style={{ gridColumn: "span 2" }}>
                            <div className="ask-label">Use of Funds</div>
                            <table className="funds-table">
                                <tbody>
                                    <tr><td>Infrastructure hardening & platform reliability</td><td>$1.5M · 30%</td></tr>
                                    <tr><td>Compute expansion — GPU provisioning & inference infrastructure</td><td>$1.25M · 25%</td></tr>
                                    <tr><td>Enterprise readiness — SOC2, security, compliance</td><td>$750K · 15%</td></tr>
                                    <tr><td>Key engineering hires — backend, infra, ML</td><td>$1.0M · 20%</td></tr>
                                    <tr><td>GTM — developer marketing, community, design partners</td><td>$500K · 10%</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="s10-milestones">
                        <div className="s10-milestone">
                            <div className="s10-milestone-month">Month 1–6</div>
                            <div className="s10-milestone-text">Compute public beta · SOC2 completion · 1,000 active developers</div>
                        </div>
                        <div className="s10-milestone">
                            <div className="s10-milestone-month">Month 6–12</div>
                            <div className="s10-milestone-text">200 paying teams · First enterprise contracts · Memory GA</div>
                        </div>
                        <div className="s10-milestone">
                            <div className="s10-milestone-month">Month 12–18</div>
                            <div className="s10-milestone-text">$2M+ ARR · Africa compute partnerships · Series A ready</div>
                        </div>
                        <div className="s10-milestone">
                            <div className="s10-milestone-month">Month 18–20</div>
                            <div className="s10-milestone-text">$3–4M ARR · Series A raise ($20–30M at $80–100M valuation)</div>
                        </div>
                    </div>
                    <div className="s10-close">
                        We are building the operating layer beneath<br /><em>production AI systems.</em>
                    </div>
                    <div className="s10-contact">
                        <div className="s10-contact-item"><label>Founder</label><span>Bola Roy Banjo</span></div>
                        <div className="s10-contact-item"><label>Email</label><span>bola@cencori.com</span></div>
                        <div className="s10-contact-item"><label>Website</label><span>cencori.com</span></div>
                        <div className="s10-contact-item"><label>Round</label><span>$5M Seed · SAFE</span></div>
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
        <Suspense fallback={<div style={{ background: "#000", width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#A3A3A3", fontFamily: "'DM Mono', monospace", fontSize: "11px", letterSpacing: ".2em", textTransform: "uppercase" }}>Loading deck…</div>}>
            <PitchDeckContent />
        </Suspense>
    );
}
