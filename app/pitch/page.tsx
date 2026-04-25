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
    const [isExporting, setIsExporting] = useState(false);
    const total = 14;

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

    const goTo = (n: number) => {
        setCurrent(n);
    };

    const navigate = (dir: number) => {
        setCurrent((prev) => (prev + dir + total) % total);
    };

    const downloadPDF = async () => {
        // Instant download via API route
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
                    --muted: #737373;
                    --muted-light: #A3A3A3;
                    --border: #1a1a1a;
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

                /* MOBILE WALL */
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

                .mobile-wall-logo {
                    font-family: 'DM Mono', monospace;
                    font-size: 12px;
                    letter-spacing: 0.5em;
                    color: #fff;
                    margin-bottom: 60px;
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
                    color: #737373;
                    line-height: 1.8;
                    max-width: 240px;
                    text-transform: uppercase;
                }

                @media (max-width: 1024px) {
                    .pitch-deck-container { display: none; }
                    .mobile-wall { display: flex; }
                }

                /* NAV */
                .nav { position: fixed; bottom: 36px; left: 50%; transform: translateX(-50%); z-index: 10000; display: flex; align-items: center; gap: 20px; }
                .nav-dots { display: flex; gap: 6px; }
                .dot { width: 4px; height: 4px; border-radius: 50%; background: #333; cursor: pointer; transition: all .3s; }
                .dot.active { background: #fff; width: 20px; border-radius: 2px; }
                .nav-btn { background: none; border: 1px solid #333; color: #737373; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .1em; padding: 6px 14px; cursor: pointer; transition: all .2s; }
                .nav-btn:hover { border-color: #fff; color: #fff; }

                /* EXPORT BUTTON */
                .export-btn { position: fixed; bottom: 36px; right: 40px; z-index: 10001; background: none; border: 1px solid #222; color: #555; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: .15em; text-transform: uppercase; padding: 6px 14px; cursor: pointer; transition: all .2s; }
                .export-btn:hover { border-color: #fff; color: #fff; }

                /* PRINT STYLES */
                @media print {
                    html, body { width: 100%; height: auto; overflow: visible !important; background: #fff; }
                    .deck { width: 100%; height: auto; position: static; }
                    .slide { position: relative !important; display: flex !important; width: 100vw; height: 100vh; page-break-after: always; break-after: page; overflow: hidden; }
                    .slide.active { display: flex !important; }
                    .nav, .slide-counter, .slide-logo, .export-btn { display: none !important; }
                    @page { size: landscape; margin: 0; }
                }

                /* SLIDE COUNTER */
                .slide-counter { position: fixed; top: 28px; right: 40px; font-family: 'DM Mono', monospace; font-size: 11px; color: #444; letter-spacing: .1em; z-index: 10000; }

                /* LOGO */
                .slide-logo { position: fixed; top: 28px; left: 40px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: .15em; color: #333; z-index: 10000; text-transform: uppercase; }

                /* SLIDE 1 */
                .s1 { background: #000; flex-direction: column; justify-content: center; align-items: flex-start; padding: 0 10%; }
                .s1-eyebrow { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: .2em; color: #444; text-transform: uppercase; margin-bottom: 32px; }
                .s1-headline { font-family: 'Playfair Display', serif; font-size: clamp(56px, 8vw, 110px); font-weight: 800; line-height: .95; color: #fff; margin-bottom: 16px; }
                .s1-headline em { font-style: italic; color: #737373; }
                .s1-sub { font-size: 15px; color: #444; max-width: 480px; line-height: 1.6; margin-bottom: 60px; font-weight: 300; }
                .s1-meta { display: flex; gap: 48px; border-top: 1px solid #1a1a1a; padding-top: 32px; }
                .s1-meta-item label { display: block; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .15em; color: #444; text-transform: uppercase; margin-bottom: 6px; }
                .s1-meta-item span { font-size: 14px; color: #fff; font-weight: 500; }
                .s1-line { display: none; }
                .s1-vertical-text { display: none; }

                /* SLIDE 2 */
                .s2 { background: #fff; flex-direction: row; }
                .s2-left { width: 50%; padding: 8% 6% 8% 10%; border-right: 1px solid #e5e5e5; display: flex; flex-direction: column; justify-content: center; }
                .s2-right { width: 50%; padding: 8% 8% 8% 6%; display: flex; flex-direction: column; justify-content: center; }
                .eyebrow { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #737373; text-transform: uppercase; margin-bottom: 24px; }
                .eyebrow-dark { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #444; text-transform: uppercase; margin-bottom: 24px; }
                .headline-dark { font-family: 'Playfair Display', serif; font-size: clamp(36px, 4vw, 56px); font-weight: 800; line-height: 1.05; color: #000; margin-bottom: 24px; }
                .headline-light { font-family: 'Playfair Display', serif; font-size: clamp(36px, 4vw, 56px); font-weight: 800; line-height: 1.05; color: #fff; margin-bottom: 24px; }
                .body-dark { font-size: 14px; color: #444; line-height: 1.75; font-weight: 300; margin-bottom: 16px; }
                .body-light { font-size: 14px; color: #737373; line-height: 1.75; font-weight: 300; margin-bottom: 16px; }
                .big-quote { font-family: 'Playfair Display', serif; font-size: clamp(24px, 3vw, 36px); font-style: italic; font-weight: 400; line-height: 1.3; color: #000; border-left: 3px solid #000; padding-left: 24px; margin: 32px 0; }
                .era-list { display: flex; flex-direction: column; gap: 0; margin-top: 32px; }
                .era-item { display: flex; align-items: flex-start; padding: 16px 0; border-bottom: 1px solid #f0f0f0; gap: 24px; }
                .era-year { font-family: 'DM Mono', monospace; font-size: 11px; color: #737373; letter-spacing: .1em; min-width: 80px; padding-top: 2px; }
                .era-company { font-size: 14px; color: #000; font-weight: 500; }
                .era-company span { color: #737373; font-weight: 300; }

                /* SLIDE 3 */
                .s3 { background: #000; flex-direction: column; justify-content: center; padding: 0 10%; }
                .problem-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #1a1a1a; margin-top: 40px; border: 1px solid #1a1a1a; }
                .problem-item { background: #000; padding: 28px 24px; position: relative; }
                .problem-num { font-family: 'Playfair Display', serif; font-size: 48px; font-weight: 800; color: #1a1a1a; line-height: 1; margin-bottom: 12px; }
                .problem-title { font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 8px; letter-spacing: .02em; }
                .problem-desc { font-size: 12px; color: #555; line-height: 1.6; font-weight: 300; }
                .problem-stat { background: #0a0a0a; border: 1px solid #1a1a1a; padding: 28px 36px; margin-top: 32px; display: flex; align-items: center; gap: 48px; }
                .problem-stat-num { font-family: 'Playfair Display', serif; font-size: 72px; font-weight: 800; color: #fff; line-height: 1; white-space: nowrap; }
                .problem-stat-text { font-size: 14px; color: #555; line-height: 1.7; font-weight: 300; max-width: 480px; }
                .problem-stat-text strong { color: #fff; font-weight: 500; }

                /* SLIDE 4 */
                .s4 { background: #fff; flex-direction: column; justify-content: center; padding: 0 10%; }
                .market-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 48px; }
                .market-nums { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #e5e5e5; margin-bottom: 40px; }
                .market-num-item { background: #fff; padding: 32px 28px; }
                .market-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #737373; text-transform: uppercase; margin-bottom: 12px; }
                .market-big { font-family: 'Playfair Display', serif; font-size: clamp(40px, 5vw, 64px); font-weight: 900; color: #000; line-height: 1; margin-bottom: 8px; }
                .market-desc { font-size: 12px; color: #737373; font-weight: 300; }
                .africa-hook { border: 1px solid #e5e5e5; padding: 28px 32px; display: flex; align-items: flex-start; gap: 32px; }
                .africa-hook-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #737373; text-transform: uppercase; white-space: nowrap; padding-top: 3px; }
                .africa-hook-text { font-size: 14px; color: #000; line-height: 1.7; }
                .africa-hook-text strong { font-weight: 600; }

                /* SLIDE 5 */
                .s5 { background: #000; flex-direction: column; justify-content: center; padding: 0 10%; }
                .solution-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #1a1a1a; margin-top: 36px; border: 1px solid #1a1a1a; }
                .solution-item { background: #000; padding: 28px 24px; }
                .solution-item.featured { background: #050505; border-left: 2px solid #fff; }
                .solution-num { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #333; margin-bottom: 16px; }
                .solution-title { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 8px; letter-spacing: .02em; }
                .solution-desc { font-size: 12px; color: #555; line-height: 1.65; font-weight: 300; }
                .solution-tagline { font-family: 'Playfair Display', serif; font-style: italic; font-size: 15px; color: #737373; border-top: 1px solid #1a1a1a; padding-top: 20px; margin-top: 24px; }

                /* SLIDE 6 */
                .s6 { background: #fff; flex-direction: row; }
                .s6-left { width: 45%; padding: 8% 5% 8% 10%; border-right: 1px solid #e5e5e5; display: flex; flex-direction: column; justify-content: center; }
                .s6-right { width: 55%; padding: 6% 8% 6% 5%; display: flex; flex-direction: column; justify-content: center; }
                .feature-list { display: flex; flex-direction: column; gap: 0; margin-top: 12px; }
                .feature-row { display: flex; align-items: flex-start; padding: 14px 0; border-bottom: 1px solid #f0f0f0; gap: 16px; }
                .feature-dot { width: 6px; height: 6px; background: #000; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
                .feature-text { font-size: 13px; color: #333; line-height: 1.5; }
                .feature-text strong { font-weight: 600; color: #000; }
                .product-badge { display: inline-block; border: 1px solid #000; padding: 4px 12px; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .15em; color: #000; text-transform: uppercase; margin-bottom: 24px; }
                .stat-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; background: #e5e5e5; margin-bottom: 24px; }
                .stat-cell { background: #fff; padding: 20px; }
                .stat-big { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 800; color: #000; line-height: 1; margin-bottom: 4px; }
                .stat-label { font-size: 11px; color: #737373; font-weight: 300; }

                /* SLIDE 7 */
                .s7 { background: #000; flex-direction: column; justify-content: center; padding: 0 10%; }
                .traction-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #1a1a1a; margin: 36px 0 32px; border: 1px solid #1a1a1a; }
                .traction-item { background: #000; padding: 28px 24px; }
                .traction-big { font-family: 'Playfair Display', serif; font-size: 44px; font-weight: 800; color: #fff; line-height: 1; margin-bottom: 8px; }
                .traction-label { font-size: 12px; color: #555; font-weight: 300; line-height: 1.5; }
                .traction-label strong { font-weight: 700; color: #fff; }
                .testimonial { border: 1px solid #1a1a1a; padding: 28px 32px; display: flex; align-items: flex-start; gap: 24px; }
                .testimonial-quote { font-family: 'Playfair Display', serif; font-style: italic; font-size: 18px; color: #fff; line-height: 1.5; flex: 1; }
                .testimonial-attr { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .1em; color: #444; margin-top: 12px; text-transform: uppercase; }

                /* SLIDE 8 */
                .s8 { background: #fff; flex-direction: column; justify-content: center; padding: 0 10%; }
                .biz-streams { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #e5e5e5; margin-top: 36px; border: 1px solid #e5e5e5; }
                .biz-stream { background: #fff; padding: 32px 28px; position: relative; }
                .biz-stream.primary { background: #000; }
                .biz-stream-num { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #ccc; margin-bottom: 16px; text-transform: uppercase; }
                .biz-stream-num.dark { color: #333; }
                .biz-stream-title { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 4px; }
                .biz-stream-title.dark { color: #000; }
                .biz-stream-badge { display: inline-block; background: #fff; color: #000; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: .15em; padding: 3px 8px; text-transform: uppercase; margin-bottom: 16px; }
                .biz-stream-badge.dark { background: #000; color: #fff; border: 1px solid #000; }
                .biz-stream-desc { font-size: 12px; line-height: 1.7; font-weight: 300; margin-bottom: 20px; color: #737373; }
                .biz-stream-desc.light { color: #777; }
                .biz-margin { font-family: 'DM Mono', monospace; font-size: 11px; color: #555; border-top: 1px solid #1a1a1a; padding-top: 16px; margin-top: 16px; }
                .biz-margin.light-border { border-color: #e5e5e5; color: #999; }
                .biz-margin strong { color: #fff; }
                .biz-margin strong.dark-strong { color: #000; }
                .compound-text { border-top: 1px solid #e5e5e5; margin-top: 32px; padding-top: 24px; font-family: 'Playfair Display', serif; font-style: italic; font-size: 15px; color: #737373; lineHeight: 1.6; }

                /* SLIDE 9 */
                .s9 { background: #000; flex-direction: column; justify-content: center; padding: 0 8%; }
                .fin-table { width: 100%; border-collapse: collapse; margin-top: 32px; font-size: 12px; }
                .fin-table th { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .15em; color: #444; text-transform: uppercase; padding: 12px 16px; text-align: left; border-bottom: 1px solid #1a1a1a; }
                .fin-table td { padding: 12px 16px; border-bottom: 1px solid #0d0d0d; font-weight: 300; color: #666; }
                .fin-table tr.total td { color: #fff; font-weight: 600; border-top: 1px solid #1a1a1a; font-size: 13px; }
                .fin-chart-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px; background: #1a1a1a; margin-top: 24px; border: 1px solid #1a1a1a; }
                .fin-chart-item { background: #000; padding: 20px; display: flex; flex-direction: column; align-items: flex-start; }
                .fin-chart-rev { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 800; color: #fff; line-height: 1; margin-bottom: 4px; }
                .fin-bar { width: 100%; height: 3px; background: #111; margin-top: 12px; position: relative; }
                .fin-bar-fill { height: 100%; background: #fff; }

                /* SLIDE 10 */
                .s10 { background: #fff; flex-direction: column; justify-content: center; padding: 0 10%; }
                .comp-table { width: 100%; border-collapse: collapse; margin-top: 36px; font-size: 13px; }
                .comp-table th { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .15em; color: #737373; text-transform: uppercase; padding: 12px 16px; text-align: center; border-bottom: 2px solid #000; }
                .comp-table td { padding: 14px 16px; border-bottom: 1px solid #f0f0f0; text-align: center; font-size: 12px; color: #737373; }
                .comp-table tr.cencori-row td { background: #000; color: #fff; font-weight: 600; }
                .check { color: #fff; font-size: 14px; }
                .cross { color: #ccc; font-size: 14px; }
                .moat-box { border: 1px solid #e5e5e5; padding: 24px 32px; margin-top: 32px; display: flex; align-items: flex-start; gap: 48px; }
                .moat-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .15em; color: #737373; text-transform: uppercase; min-width: 80px; padding-top: 3px; }
                .moat-text { font-family: 'Playfair Display', serif; font-style: italic; font-size: 14px; color: #000; line-height: 1.6; flex: 1; }

                /* SLIDE 11 */
                .s11 { background: #000; flex-direction: column; justify-content: center; padding: 0 10%; }
                .vision-list { display: flex; flex-direction: column; gap: 0; margin-top: 36px; max-width: 800px; }
                .vision-item { display: flex; gap: 32px; padding: 24px 0; border-bottom: 1px solid #4d4c4cff; align-items: flex-start; }
                .vision-year { font-family: 'DM Mono', monospace; font-size: 11px; color: #969494ff; min-width: 80px; }
                .vision-text { font-size: 14px; color: #555; line-height: 1.7; font-weight: 300; }
                .vision-close { font-family: 'Playfair Display', serif; font-size: clamp(28px, 4vw, 44px); font-weight: 800; font-style: italic; color: #fff; margin-top: 48px; }

                /* SLIDE 12 */
                .s12 { background: #fff; flex-direction: row; }
                .s12-left { width: 50%; padding: 8% 5% 8% 10%; border-right: 1px solid #e5e5e5; display: flex; flex-direction: column; justify-content: center; }
                .s12-right { width: 50%; padding: 8% 8% 8% 5%; display: flex; flex-direction: column; justify-content: center; }
                .team-member { display: flex; align-items: flex-start; gap: 20px; }
                .team-avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid #e5e5e5; }
                .team-info { flex: 1; }
                .team-name { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; color: #000; margin-bottom: 4px; }
                .team-title { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .15em; color: #737373; text-transform: uppercase; margin-bottom: 20px; }
                .team-bio { font-size: 13px; color: #555; line-height: 1.75; font-weight: 300; margin-bottom: 12px; }
                .team-divider { border: none; border-top: 1px solid #e5e5e5; margin: 24px 0; }
                .need-list { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
                .need-item { display: flex; align-items: center; gap: 12px; font-size: 13px; color: #333; }
                .need-icon { width: 6px; height: 6px; background: #000; border-radius: 50%; flex-shrink: 0; }

                /* SLIDE 13 */
                .s13 { background: #000; flex-direction: column; justify-content: center; padding: 0 10%; }
                .ask-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 1px; background: #1a1a1a; margin-top: 36px; border: 1px solid #1a1a1a; width: 100%; }
                .ask-cell { background: #000; padding: 32px 28px; }
                .ask-cell.featured { background: #fff; }
                .ask-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .2em; color: #444; text-transform: uppercase; margin-bottom: 12px; }
                .ask-label.dark { color: #737373; }
                .ask-value { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 800; color: #fff; line-height: 1; margin-bottom: 8px; }
                .ask-value.dark { color: #000; }
                .ask-value-sub { font-size: 12px; color: #555; font-weight: 300; }
                .ask-value-sub.dark { color: #737373; }
                .funds-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
                .funds-table td { padding: 8px 0; border-bottom: 1px solid #0d0d0d; color: #666; }
                .milestones { display: flex; flex-direction: column; gap: 0; margin-top: 16px; }
                .milestone-item { display: flex; gap: 16px; padding: 12px 0; border-bottom: 1px solid #0d0d0d; }
                .milestone-month { font-family: 'DM Mono', monospace; font-size: 10px; color: #333; min-width: 70px; }
                .milestone-text { font-size: 12px; color: #555; font-weight: 300; }

                /* SLIDE 14 */
                .s14 { background: #000; flex-direction: column; justify-content: center; align-items: flex-start; padding: 0 10%; }
                .closing-eras { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #1a1a1a; border: 1px solid #1a1a1a; margin-bottom: 48px; width: 100%; }
                .closing-era { background: #000; padding: 24px; display: flex; flex-direction: column; gap: 8px; }
                .closing-era.active { background: #fff; }
                .closing-era-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .15em; color: #444; text-transform: uppercase; }
                .closing-era-label.dark { color: #737373; }
                .closing-era-company { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: #fff; }
                .closing-era-company.dark { color: #000; }
                .closing-era-role { font-size: 11px; color: #333; font-weight: 300; line-height: 1.4; }
                .closing-era-role.dark { color: #737373; }
                .closing-headline { font-family: 'Playfair Display', serif; font-size: clamp(40px, 6vw, 72px); font-weight: 900; color: #fff; line-height: 1; margin-bottom: 24px; }
                .closing-contact { display: flex; gap: 48px; border-top: 1px solid #1a1a1a; padding-top: 32px; width: 100%; }
                .closing-contact-item label { display: block; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .15em; color: #444; text-transform: uppercase; margin-bottom: 6px; }
                .closing-contact-item span { font-size: 14px; color: #fff; font-weight: 500; }
            `}</style>

            <div className="slide-logo">
                <img src="/logo white.svg" alt="Cencori Logo" style={{ width: "48px", height: "auto" }} />
            </div>
            <div className="slide-counter" id="counter">
                {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </div>

            <div className="deck">
                {/* SLIDE 1 — COVER */}
                <div className={`slide s1 ${isPrintMode || current === 0 ? "active" : ""}`}>
                    <div className="s1-line"></div>
                    <div className="s1-vertical-text">Intelligence Infrastructure · Seed Round 2026</div>
                    <div className="s1-eyebrow">Seed Round · $3M · SAFE</div>
                    <div className="s1-headline">The backbone<br />of <em>intelligence.</em></div>
                    <div className="s1-sub">The complete stack for building, deploying, and monetizing AI and intelligent systems. One platform. Every layer.</div>
                    <div className="s1-meta">
                        <div className="s1-meta-item"><label>Raising</label><span>$3,000,000</span></div>
                        <div className="s1-meta-item"><label>Valuation Cap</label><span>$18,000,000</span></div>
                        <div className="s1-meta-item"><label>Instrument</label><span>SAFE</span></div>
                        <div className="s1-meta-item"><label>Founder</label><span>Bola Roy Banjo</span></div>
                    </div>
                </div>

                {/* SLIDE 2 — THE MOMENT */}
                <div className={`slide s2 ${isPrintMode || current === 1 ? "active" : ""}`}>
                    <div className="s2-left">
                        <div className="eyebrow">The Moment</div>
                        <div className="headline-dark">We've seen this<br />shift before.</div>
                        <div className="body-dark">Every era of computing created one infrastructure company that became indispensable. They didn't invent the era. They built the layer that made it economically productive.</div>
                        <div className="big-quote">"AI is a larger shift than the internet. And it needs its own infrastructure layer."</div>
                        <div className="body-dark">That infrastructure doesn't exist yet in a unified form. Cencori is building it.</div>
                    </div>
                    <div className="s2-right">
                        <div className="era-list">
                            <div className="era-item">
                                <div className="era-year">MAINFRAME</div>
                                <div><div className="era-company">IBM <span>— became the backbone of enterprise computing</span></div></div>
                            </div>
                            <div className="era-item">
                                <div className="era-year">INTERNET</div>
                                <div><div className="era-company">AWS <span>— became the backbone of cloud infrastructure</span></div></div>
                            </div>
                            <div className="era-item">
                                <div className="era-year">MOBILE</div>
                                <div><div className="era-company">Stripe + Twilio <span>— became the backbone of the mobile economy</span></div></div>
                            </div>
                            <div className="era-item" style={{ borderBottom: "none" }}>
                                <div className="era-year">INTELLIGENCE</div>
                                <div><div className="era-company" style={{ fontWeight: 700 }}>Cencori <span style={{ color: "#000", fontWeight: 400 }}>— the backbone of intelligence</span></div></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SLIDE 3 — THE PROBLEM */}
                <div className={`slide s3 ${isPrintMode || current === 2 ? "active" : ""}`}>
                    <div className="eyebrow-dark">The Problem</div>
                    <div className="headline-light" style={{ maxWidth: "700px" }}>Building an AI product means solving 7 problems you didn't sign up for.</div>
                    <div className="problem-grid">
                        <div className="problem-item"><div className="problem-num">01</div><div className="problem-title">Routing</div><div className="problem-desc">Which AI provider? How do you handle fallbacks when one goes down?</div></div>
                        <div className="problem-item"><div className="problem-num">02</div><div className="problem-title">Rate Limiting</div><div className="problem-desc">How do you prevent abuse and stop runaway costs from a single bad actor?</div></div>
                        <div className="problem-item"><div className="problem-num">03</div><div className="problem-title">Cost Control</div><div className="problem-desc">How do you track spend per user, per project, per feature?</div></div>
                        <div className="problem-item"><div className="problem-num">04</div><div className="problem-title">Billing</div><div className="problem-desc">How do you charge your own customers for AI usage without building a billing engine?</div></div>
                        <div className="problem-item"><div className="problem-num">05</div><div className="problem-title">Compute</div><div className="problem-desc">Where do you run training, fine-tuning, and inference at scale?</div></div>
                        <div className="problem-item"><div className="problem-num">06</div><div className="problem-title">Memory</div><div className="problem-desc">How do your AI features remember context across sessions?</div></div>
                        <div className="problem-item"><div className="problem-num">07</div><div className="problem-title">Deployment</div><div className="problem-desc">How do you ship the intelligent product to production reliably?</div></div>
                        <div className="problem-item" style={{ border: "none", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ textAlign: "center" }}><div style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", letterSpacing: ".2em", color: "#333", textTransform: "uppercase", marginBottom: "8px" }}>The result</div><div style={{ fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontSize: "16px", color: "#555", lineHeight: "1.4" }}>7 vendors.<br />7 invoices.<br />1 fragile stack.</div></div></div>
                    </div>
                    <div className="problem-stat">
                        <div className="problem-stat-num">6–9<span style={{ fontSize: "32px", color: "#444" }}>mo</span></div>
                        <div className="problem-stat-text">The average team spends <strong>6 to 9 months solving infrastructure</strong> before they write a single line of product code. That is 6 to 9 months of runway burned on problems that have nothing to do with their actual idea.</div>
                    </div>
                </div>

                {/* SLIDE 4 — MARKET */}
                <div className={`slide s4 ${isPrintMode || current === 3 ? "active" : ""}`}>
                    <div className="eyebrow">Market Opportunity</div>
                    <div className="market-header">
                        <div className="headline-dark" style={{ marginBottom: 0 }}>This is not a market.<br /><em style={{ fontStyle: "italic", color: "#737373" }}>It is a category.</em></div>
                        <div style={{ fontSize: "12px", color: "#737373", fontWeight: 300, maxWidth: "280px", textAlign: "right", lineHeight: 1.7 }}>Infrastructure spend is shifting from general cloud to intelligence infrastructure. The window to own this category is now.</div>
                    </div>
                    <div className="market-nums">
                        <div className="market-num-item">
                            <div className="market-label">TAM — GLOBAL AI MARKET</div>
                            <div className="market-big">$1.81T</div>
                            <div className="market-desc">Total economic value of the AI era by 2030<br /><span style={{ fontSize: '12px', opacity: 0.5 }}>Source: Statista / Fortune Business Insights</span></div>
                        </div>
                        <div className="market-num-item" style={{ borderLeft: "1px solid #e5e5e5" }}>
                            <div className="market-label">SAM — INFRASTRUCTURE</div>
                            <div className="market-big">$420B</div>
                            <div className="market-desc">The "Category": Compute, Gateway, Security<br /><span style={{ fontSize: '12px', opacity: 0.5 }}>Source: BCC Research 2030 Forecast</span></div>
                        </div>
                        <div className="market-num-item" style={{ borderLeft: "1px solid #e5e5e5" }}>
                            <div className="market-label">TARGET — PHASE 1</div>
                            <div className="market-big">$420M</div>
                            <div className="market-desc">0.1% capture of the infrastructure category<br /><span style={{ fontSize: '12px', opacity: 0.5 }}>Initial ICP: Mid-Enterprise & Scale-ups</span></div>
                        </div>
                    </div>
                    <div className="africa-hook">
                        <div className="africa-hook-label">The Africa Hook</div>
                        <div className="africa-hook-text">Cencori is the <strong>first intelligence infrastructure company</strong> built from Africa for the world. <strong>1.4 billion people.</strong> Fastest growing developer ecosystem on earth. <strong>Zero dominant infrastructure player.</strong> A first-mover position in a continent-scale market that every major infrastructure company is ignoring. <strong>That is not a risk story. It is the opportunity.</strong></div>
                    </div>
                </div>

                {/* SLIDE 5 — SOLUTION */}
                <div className={`slide s5 ${isPrintMode || current === 4 ? "active" : ""}`}>
                    <div className="eyebrow-dark">The Solution</div>
                    <div className="headline-light">One platform.<br />Every layer.</div>
                    <div className="solution-grid">
                        <div className="solution-item featured"><div className="solution-num">01 — SHIPPED</div><div className="solution-title">AI Gateway</div><div className="solution-desc">Unified endpoint for 100+ models across every major provider. Security, routing, observability, jailbreak detection, circuit breakers, and rate limiting built into every request. One integration. Every provider.</div></div>
                        <div className="solution-item"><div className="solution-num">02 — IN BUILD</div><div className="solution-title">Compute</div><div className="solution-desc">GPU-backed compute for training, fine-tuning, and inference. Software-defined today, proprietary silicon on the roadmap. The primary revenue engine — scales automatically with customer growth.</div></div>
                        <div className="solution-item"><div className="solution-num">03 — SHIPPED</div><div className="solution-title">End-User Billing</div><div className="solution-desc">The feature no other gateway has. Meter, limit, and charge your own users for AI usage. Stripe Connect native. Percentage markup, flat fees, or both. Turn raw AI cost into margin instantly.</div></div>
                        <div className="solution-item"><div className="solution-num">04 — ROADMAP</div><div className="solution-title">Memory</div><div className="solution-desc">Persistent memory layer for AI applications. Users get products that remember them. Developers get better retention. Products get smarter over time.</div></div>
                        <div className="solution-item"><div className="solution-num">05 — ROADMAP</div><div className="solution-title">Workflow & Orchestration</div><div className="solution-desc">Agentic workflow orchestration for complex AI products. Multi-step reasoning, tool use, agent coordination — without building it from scratch.</div></div>
                        <div className="solution-item" style={{ display: "flex", alignItems: "flex-end" }}><div style={{ width: "100%" }}><div className="solution-tagline">"From your first API call<br />to your billionth."</div></div></div>
                    </div>
                </div>

                {/* SLIDE 6 — PRODUCT */}
                <div className={`slide s6 ${isPrintMode || current === 5 ? "active" : ""}`}>
                    <div className="s6-left">
                        <div className="eyebrow">Product</div>
                        <div className="headline-dark">Not a deck.<br />A live product.</div>
                        <div className="body-dark">The AI Gateway is in production. End-User Billing is shipped and active. The dashboard is live. Developers are integrating right now.</div>
                        <div className="stat-row" style={{ marginTop: "32px" }}>
                            <div className="stat-cell"><div className="stat-big">100+</div><div className="stat-label">Models supported</div></div>
                            <div className="stat-cell" style={{ borderLeft: "1px solid #e5e5e5" }}><div className="stat-big">10+</div><div className="stat-label">AI providers</div></div>
                            <div className="stat-cell" style={{ borderTop: "1px solid #e5e5e5" }}><div className="stat-big">3</div><div className="stat-label">SDKs shipped (TS, Python, Go)</div></div>
                            <div className="stat-cell" style={{ borderTop: "1px solid #e5e5e5", borderLeft: "1px solid #e5e5e5" }}><div className="stat-big">200+</div><div className="stat-label">Users across platform</div></div>
                        </div>
                    </div>
                    <div className="s6-right">
                        <div className="product-badge">Gateway Features — Shipped</div>
                        <div className="feature-list">
                            <div className="feature-row"><div className="feature-dot"></div><div className="feature-text"><strong>Circuit breakers</strong> — automatic cross-provider failover when a provider degrades</div></div>
                            <div className="feature-row"><div className="feature-dot"></div><div className="feature-text"><strong>Jailbreak detection</strong> — pre-request scanning, blocks malicious intent before it hits the model</div></div>
                            <div className="feature-row"><div className="feature-dot"></div><div className="feature-text"><strong>PII masking & output scanning</strong> — real-time data rules, redact sensitive information in flight</div></div>
                            <div className="feature-row"><div className="feature-dot"></div><div className="feature-text"><strong>Tamper-proof audit trails</strong> — every request, every action, immutable log</div></div>
                            <div className="feature-row"><div className="feature-dot"></div><div className="feature-text"><strong>SSO / SAML</strong> — enterprise-ready identity management</div></div>
                            <div className="feature-row"><div className="feature-dot"></div><div className="feature-text"><strong>Cost forecasting</strong> — project next month's AI spend from current trajectory</div></div>
                            <div className="feature-row"><div className="feature-dot"></div><div className="feature-text"><strong>End-User Billing</strong> — Stripe Connect, rate plans, auto-invoicing, markup pricing</div></div>
                            <div className="feature-row" style={{ borderBottom: "none" }}><div className="feature-dot"></div><div className="feature-text"><strong>OpenAPI spec + Playground</strong> — full documentation, in-dashboard request tester</div></div>
                        </div>
                    </div>
                </div>

                {/* SLIDE 7 — TRACTION */}
                <div className={`slide s7 ${isPrintMode || current === 6 ? "active" : ""}`}>
                    <div className="eyebrow-dark">Traction</div>
                    <div className="headline-light">Pre-revenue.<br />Not pre-validation. Not Pre-Traction.</div>
                    <div className="traction-grid">
                        <div className="traction-item"><div className="traction-big">200+</div><div className="traction-label">Users across gateway<br />and platform</div></div>
                        <div className="traction-item"><div className="traction-big">2K+</div><div className="traction-label">SDK Downloads in<br />2 weeks, zero paid</div></div>
                        <div className="traction-item"><div className="traction-big">∞</div><div className="traction-label">In talks with <strong>UBA</strong>, the<br />largest bank in Africa</div></div>
                        <div className="traction-item"><div className="traction-big"><Anthropic size={32} /></div><div className="traction-label">Anthropic official<br />partner in Africa</div></div>
                    </div>
                    <div className="testimonial">
                        <div>
                            <div className="testimonial-quote">"My love for Cencori is unmatched. They help me hit my KPIs so fast."</div>
                            <div className="testimonial-attr">@OladeindeMayowa — Active Customer, Public Statement</div>
                        </div>
                        <div style={{ borderLeft: "1px solid #1a1a1a", paddingLeft: "32px", minWidth: "220px" }}>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", letterSpacing: ".2em", color: "#333", textTransform: "uppercase", marginBottom: "12px" }}>What this means</div>
                            <div style={{ fontSize: "12px", color: "#555", lineHeight: 1.7, fontWeight: 300 }}>Real teams found Cencori organically, integrated it, and are hitting business goals with it. Zero marketing spend. The machine works. We just need the fuel.</div>
                        </div>
                    </div>
                </div>

                {/* SLIDE 8 — BUSINESS MODEL */}
                <div className={`slide s8 ${isPrintMode || current === 7 ? "active" : ""}`}>
                    <div className="eyebrow">Business Model</div>
                    <div className="headline-dark">Three streams.<br />All compounding.</div>
                    <div className="biz-streams">
                        <div className="biz-stream primary">
                            <div className="biz-stream-num">01</div>
                            <div className="biz-stream-title">Compute</div>
                            <div className="biz-stream-badge">Primary Revenue Engine</div>
                            <div className="biz-stream-desc light">GPU compute billed per usage. Every training run, fine-tuning job, and inference call generates margin. The AWS model — revenue scales automatically with customer growth.</div>
                            <div className="biz-margin"><strong>45–60%</strong> target gross margin</div>
                        </div>
                        <div className="biz-stream">
                            <div className="biz-stream-num dark">02</div>
                            <div className="biz-stream-title dark">Platform Subscription</div>
                            <div className="biz-stream-badge dark">Recurring Revenue</div>
                            <div className="biz-stream-desc">Tiered access to the full Cencori platform — gateway, memory, workflow, billing, integrations.<br /><br />Starter $49/mo · Growth $299/mo · Enterprise Custom</div>
                            <div className="biz-margin light-border"><strong className="dark-strong">80%+</strong> target gross margin</div>
                        </div>
                        <div className="biz-stream">
                            <div className="biz-stream-num dark">03</div>
                            <div className="biz-stream-title dark">Billing Revenue Share</div>
                            <div className="biz-stream-badge dark">Aligned Incentives</div>
                            <div className="biz-stream-desc">A percentage of revenue our customers collect from their own users through Cencori's billing layer. When they grow, we grow. Zero incremental sales motion.</div>
                            <div className="biz-margin light-border"><strong className="dark-strong">0.5–1.5%</strong> take rate on billing volume</div>
                        </div>
                    </div>
                    <div className="compound-text">A customer who starts on $49/month, scales their product, runs compute, and bills their users — generates revenue across all three streams simultaneously. We win every month they grow.</div>
                </div>

                {/* SLIDE 9 — FINANCIALS */}
                <div className={`slide s9 ${isPrintMode || current === 8 ? "active" : ""}`}>
                    <div className="eyebrow-dark">Financial Projections</div>
                    <div className="headline-light" style={{ fontSize: "clamp(28px,3.5vw,44px)" }}>Conservative. Achievable.<br /><em style={{ color: "#444" }}>Compounding.</em></div>
                    <div className="fin-chart-row">
                        <div className="fin-chart-item">
                            <div className="fin-chart-year">YEAR 1 — 2026</div>
                            <div className="fin-chart-rev">$222K</div>
                            <div className="fin-chart-sub">50 teams · 10 on compute · 5 on billing</div>
                            <div className="fin-bar"><div className="fin-bar-fill" style={{ width: "3%" }}></div></div>
                        </div>
                        <div className="fin-chart-item">
                            <div className="fin-chart-year">YEAR 2 — 2027</div>
                            <div className="fin-chart-rev">$1.7M</div>
                            <div className="fin-chart-sub">200 teams · 60 on compute · First enterprise</div>
                            <div className="fin-bar"><div className="fin-bar-fill" style={{ width: "23%" }}></div></div>
                        </div>
                        <div className="fin-chart-item">
                            <div className="fin-chart-year">YEAR 3 — 2028</div>
                            <div className="fin-chart-rev">$7.4M</div>
                            <div className="fin-chart-sub">600 teams · 200 on compute · Labs + enterprise</div>
                            <div className="fin-bar"><div className="fin-bar-fill" style={{ width: "100%" }}></div></div>
                        </div>
                    </div>
                    <table className="fin-table">
                        <thead>
                            <tr>
                                <th>Revenue Stream</th>
                                <th className="fin-year">2026</th>
                                <th className="fin-year">2027</th>
                                <th className="fin-year">2028</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="revenue"><td>Platform Subscriptions</td><td>$84K</td><td>$480K</td><td>$1.8M</td></tr>
                            <tr className="revenue"><td>Compute</td><td>$120K</td><td>$900K</td><td>$4.2M</td></tr>
                            <tr className="revenue"><td>End-User Billing Share</td><td>$18K</td><td>$120K</td><td>$600K</td></tr>
                            <tr className="revenue"><td>Enterprise Contracts</td><td>—</td><td>$200K</td><td>$800K</td></tr>
                            <tr className="total"><td>Total Revenue</td><td>$222K</td><td>$1.7M</td><td>$7.4M</td></tr>
                            <tr className="section-header"><td colSpan={4}>Annual Burn</td></tr>
                            <tr className="revenue"><td>Total Burn</td><td>$420K</td><td>$1.0M</td><td>$2.3M</td></tr>
                            <tr className="total"><td>Net Position</td><td style={{ color: "#555" }}>$(198K)</td><td style={{ color: "#aaa" }}>$700K</td><td style={{ color: "#fff" }}>$5.1M</td></tr>
                        </tbody>
                    </table>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "14px", color: "#fff", marginTop: "32px", letterSpacing: ".05em", borderTop: "1px solid #1a1a1a", paddingTop: "24px" }}>Series A trigger: $3–4M ARR → $20–30M raise at $80–100M valuation · Mid-Year 3</div>
                </div>

                {/* SLIDE 10 — COMPETITION */}
                <div className={`slide s10 ${isPrintMode || current === 9 ? "active" : ""}`}>
                    <div className="eyebrow">Competitive Landscape</div>
                    <div className="headline-dark">Nobody owns<br />the full stack.</div>
                    <table className="comp-table">
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th>AI Gateway</th>
                                <th>Compute</th>
                                <th>End-User Billing</th>
                                <th>Full Stack</th>
                                <th>Africa-Native</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>OpenRouter</td><td><span className="check-dark" style={{ color: "#ccc" }}>✓</span></td><td><span className="cross">✗</span></td><td><span className="cross">✗</span></td><td><span className="cross">✗</span></td><td><span className="cross">✗</span></td></tr>
                            <tr><td>Portkey</td><td><span className="check-dark" style={{ color: "#ccc" }}>✓</span></td><td><span className="cross">✗</span></td><td><span className="cross">✗</span></td><td><span className="cross">✗</span></td><td><span className="cross">✗</span></td></tr>
                            <tr><td>LiteLLM</td><td><span className="check-dark" style={{ color: "#ccc" }}>✓</span></td><td><span className="cross">✗</span></td><td><span className="cross">✗</span></td><td><span className="cross">✗</span></td><td><span className="cross">✗</span></td></tr>
                            <tr><td>AWS Bedrock</td><td><span className="check-dark" style={{ color: "#ccc" }}>✓</span></td><td><span className="check-dark" style={{ color: "#ccc" }}>✓</span></td><td><span className="cross">✗</span></td><td><span className="partial">Partial</span></td><td><span className="cross">✗</span></td></tr>
                            <tr><td>CoreWeave</td><td><span className="cross">✗</span></td><td><span className="check-dark" style={{ color: "#ccc" }}>✓</span></td><td><span className="cross">✗</span></td><td><span className="cross">✗</span></td><td><span className="cross">✗</span></td></tr>
                            <tr className="cencori-row"><td>Cencori</td><td><span className="check">✓</span></td><td><span className="check">✓</span></td><td><span className="check">✓</span></td><td><span className="check">✓</span></td><td><span className="check">✓</span></td></tr>
                        </tbody>
                    </table>
                    <div className="moat-box">
                        <div className="moat-label">The Moat</div>
                        <div className="moat-text">A team that builds on Cencori's gateway, runs compute on Cencori, and bills their users through Cencori is not switching. Migrating three critical infrastructure layers simultaneously is prohibitive. That stickiness compounds with every additional layer a customer adopts.</div>
                    </div>
                </div>

                {/* SLIDE 11 — VISION */}
                <div className={`slide s11 ${isPrintMode || current === 10 ? "active" : ""}`}>
                    <div className="eyebrow-dark">The Vision</div>
                    <div className="headline-light">Cencori in<br />ten years.</div>
                    <div className="vision-list">
                        <div className="vision-item">
                            <div className="vision-year">AFRICA</div>
                            <div className="vision-text">Research labs across the continent <strong>train frontier models on Cencori compute</strong> — not renting from AWS in Virginia, but on infrastructure built from this continent, owned by this continent.</div>
                        </div>
                        <div className="vision-item">
                            <div className="vision-year">STARTUPS</div>
                            <div className="vision-text">Founders in Lagos, Manchester, Kampala, and San Francisco <strong>ship world-class AI products</strong> on Cencori's full stack — without a single external infrastructure dependency.</div>
                        </div>
                        <div className="vision-item">
                            <div className="vision-year">ENTERPRISE</div>
                            <div className="vision-text">Enterprises globally route <strong>billions of AI requests</strong> through Cencori's gateway — with full compliance, audit trails, and cost control built into every request.</div>
                        </div>
                        <div className="vision-item" style={{ borderBottom: "none" }}>
                            <div className="vision-year">HARDWARE</div>
                            <div className="vision-text">Developers build <strong>intelligent products spanning software and hardware</strong> — robotics, mechatronics, autonomous systems — all running on Cencori's infrastructure and silicon.</div>
                        </div>
                    </div>
                    <div className="vision-close">"The company that owns the infrastructure layer of the AI economy owns one of the most valuable positions in the history of technology."</div>
                </div>

                {/* SLIDE 12 — TEAM */}
                <div className={`slide s12 ${isPrintMode || current === 11 ? "active" : ""}`}>
                    <div className="s12-left">
                        <div className="eyebrow">The Founders</div>
                        <div className="team-member">
                            <img src="/roy.png" alt="Bola Roy Banjo" className="team-avatar" />
                            <div className="team-info">
                                <div className="team-name">Bola Roy Banjo</div>
                                <div className="team-title">CEO & Co-founder</div>
                            </div>
                        </div>
                        <div className="team-bio">22 years old. BSc Mechanical Engineering. Built Cencori from zero to a production-grade intelligence infrastructure platform with 200+ users, shipped features, and enterprise-ready architecture.</div>
                        <div className="team-bio">Background in mechanical engineering and software gives a systems-level perspective on intelligence infrastructure that pure software engineers miss. The hardware and robotics roadmap is a natural extension of how Bola thinks about intelligent systems from first principles.</div>
                        <div className="team-bio" style={{ color: "#000", fontWeight: 500 }}>Energy tech work that attracted interest from researchers at Harvard and MIT.</div>
                        <hr className="team-divider" />
                        <div className="team-member">
                            <img src="/daniel-avatar.png" alt="Oreofe Ojurereoluwa Daniel" className="team-avatar" />
                            <div className="team-info">
                                <div className="team-name">Oreofe Ojurereoluwa Daniel</div>
                                <div className="team-title">COO & Co-founder</div>
                            </div>
                        </div>
                        <div className="team-bio">Operations, execution, and business infrastructure. Oreofe architected the organizational backbone of Cencori — from compliance frameworks and vendor negotiations to the operational playbooks that let a two-person team ship at the velocity of a funded startup.</div>
                        <div className="team-bio">Background in business administration and strategic operations. While most early-stage COOs manage chaos, Oreofe builds systems that eliminate it. Partnership pipelines, financial modeling, investor relations, and the operational discipline that turns raw engineering output into a company that scales.</div>
                        <div className="team-bio" style={{ color: "#000", fontWeight: 500 }}>The person who turns "we built it" into "we shipped it, sold it, and closed the deal." Every infrastructure company needs a builder. Every great one needs an operator who refuses to let the machine stall.</div>
                    </div>
                    <div className="s12-right">
                        <div className="eyebrow">What This Raise Hires</div>
                        <div className="body-dark" style={{ marginBottom: "24px" }}>We are not pretending the team is complete. It is not. These are the people who take us to Series A.</div>
                        <div className="need-list">
                            <div className="need-item"><div className="need-icon"></div>2× Senior Backend Engineers — compute layer and platform reliability</div>
                            <div className="need-item"><div className="need-icon"></div>1× Infrastructure Engineer — GPU provisioning, uptime, scale</div>
                            <div className="need-item"><div className="need-icon"></div>1× Go-to-Market Lead — developer marketing, outbound, Africa activation</div>
                        </div>
                        <hr className="team-divider" />
                        <div className="eyebrow">Anthropic Partnership</div>
                        <div className="body-dark">Cencori is an official Anthropic partner in Africa — a structural credibility signal that accelerates enterprise conversations and positions Cencori at the center of the continent's AI ecosystem from day one.</div>
                        <div style={{ marginTop: "24px", border: "1px solid #e5e5e5", padding: "20px 24px" }}>
                            <div className="body-dark" style={{ fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontSize: "15px", color: "#000", margin: 0 }}>"In talks with the largest bank in Africa, controlling billions in annual transactions."</div>
                        </div>
                    </div>
                </div>

                {/* SLIDE 13 — THE ASK */}
                <div className={`slide s13 ${isPrintMode || current === 12 ? "active" : ""}`}>
                    <div className="eyebrow-dark">The Ask</div>
                    <div className="headline-light">$3M to reach<br />the inflection point.</div>
                    <div className="ask-grid">
                        <div className="ask-cell featured">
                            <div className="ask-label dark">Raising</div>
                            <div className="ask-value dark">$3,000,000</div>
                            <div className="ask-value-sub dark">SAFE · Post-money cap $18M</div>
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
                                    <tr><td>Engineering — 2 senior backend + 1 infra engineer</td><td>$1,500,000 · 50%</td></tr>
                                    <tr><td>Infrastructure & Compute — GPU provisioning, redundancy</td><td>$600,000 · 20%</td></tr>
                                    <tr><td>Go-to-Market — developer marketing, outbound, Africa</td><td>$600,000 · 20%</td></tr>
                                    <tr><td>Operations & Legal</td><td>$300,000 · 10%</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "#1a1a1a", border: "1px solid #1a1a1a" }}>
                        <div style={{ background: "#000", padding: "20px 24px" }}>
                            <div className="ask-label" style={{ marginBottom: "12px" }}>Milestones This Capital Unlocks</div>
                            <div className="milestones">
                                <div className="milestone-item"><div className="milestone-month">Month 6</div><div className="milestone-text">Compute product in public beta</div></div>
                                <div className="milestone-item"><div className="milestone-month">Month 12</div><div className="milestone-text">200 active paying teams</div></div>
                                <div className="milestone-item"><div className="milestone-month">Month 16</div><div className="milestone-text">$1M ARR + Africa compute partnerships</div></div>
                                <div className="milestone-item" style={{ borderBottom: "none" }}><div className="milestone-month">Month 20</div><div className="milestone-text">Series A ready — $3–4M ARR</div></div>
                            </div>
                        </div>
                        <div style={{ background: "#000", padding: "20px 24px", borderLeft: "1px solid #1a1a1a" }}>
                            <div className="ask-label" style={{ marginBottom: "12px" }}>Series A Profile</div>
                            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "32px", fontWeight: 800, color: "#fff", lineHeight: 1, marginBottom: "8px" }}>$20–30M</div>
                            <div style={{ fontSize: "12px", color: "#555", fontWeight: 300, lineHeight: 1.6 }}>At $3–4M ARR mid-Year 3, Cencori raises a Series A to accelerate compute infrastructure, Africa expansion, and hardware roadmap. Projected valuation: $80–100M.</div>
                        </div>
                    </div>
                </div>

                {/* SLIDE 14 — CLOSING */}
                <div className={`slide s14 ${isPrintMode || current === 13 ? "active" : ""}`}>
                    <div className="eyebrow-dark" style={{ marginBottom: "16px" }}>Every era needs its infrastructure company.</div>
                    <div className="closing-eras">
                        <div className="closing-era"><div className="closing-era-label">Mainframe Era</div><div className="closing-era-company">IBM</div><div className="closing-era-role">Enterprise computing backbone</div></div>
                        <div className="closing-era"><div className="closing-era-label">Internet Era</div><div className="closing-era-company">AWS</div><div className="closing-era-role">Cloud infrastructure backbone</div></div>
                        <div className="closing-era"><div className="closing-era-label">Mobile Era</div><div className="closing-era-company">Stripe + Twilio</div><div className="closing-era-role">Mobile economy backbone</div></div>
                        <div className={`closing-era ${current === 13 ? "active" : ""}`}><div className={`closing-era-label ${current === 13 ? "dark" : ""}`}>Intelligence Era</div><div className={`closing-era-company ${current === 13 ? "dark" : ""}`}>Cencori</div><div className={`closing-era-role ${current === 13 ? "dark" : ""}`}>Intelligence infrastructure backbone</div></div>
                    </div>
                    <div className="closing-headline">The backbone of<br /><em>intelligence.</em><br />We are just<br />getting started.</div>
                    <div className="closing-contact">
                        <div className="closing-contact-item"><label>Founder</label><span>Bola Roy Banjo</span></div>
                        <div className="closing-contact-item"><label>Email</label><span>bola@cencori.com</span></div>
                        <div className="closing-contact-item"><label>Website</label><span>cencori.com</span></div>
                        <div className="closing-contact-item"><label>Round</label><span>$3M SAFE · $18M Cap</span></div>
                    </div>
                </div>
            </div>

            {/* NAVIGATION */}
            <div className="nav">
                <button className="nav-btn" onClick={() => navigate(-1)}>← PREV</button>
                <div className="nav-dots">
                    {[...Array(total)].map((_, i) => (
                        <div
                            key={i}
                            className={`dot ${current === i ? "active" : ""}`}
                            onClick={() => goTo(i)}
                        />
                    ))}
                </div>
                <button className="nav-btn" onClick={() => navigate(1)}>NEXT →</button>
            </div>

            {/* EXPORT BUTTON */}
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
        <Suspense fallback={<div>Loading...</div>}>
            <PitchDeckContent />
        </Suspense>
    );
}
