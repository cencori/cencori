'use client';

import { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface SDKTab {
    value: string;
    label: string;
    disabled?: boolean;
    content: ReactNode;
}

interface SDKTabsProps {
    tabs: SDKTab[];
    defaultValue?: string;
}

export function SDKTabs({ tabs, defaultValue }: SDKTabsProps) {
    return (
        <Tabs defaultValue={defaultValue || tabs[0]?.value} className="w-full">
            <TabsList className="mb-0">
                {tabs.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value} disabled={tab.disabled}>
                        {tab.label}
                    </TabsTrigger>
                ))}
            </TabsList>

            {tabs.map((tab) => (
                <TabsContent key={tab.value} value={tab.value} className="space-y-8">
                    {tab.content}
                </TabsContent>
            ))}
        </Tabs>
    );
}
