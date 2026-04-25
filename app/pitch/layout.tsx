"use client";

import React from "react";

export default function PitchLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-black text-white dark">
            <main>{children}</main>
        </div>
    );
}
