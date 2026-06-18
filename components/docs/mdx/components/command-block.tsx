"use client";

import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { NpmIcon, YarnIcon, BunIcon, PnpmIcon } from "@/assets/icons";
import { useState } from "react";
import CopyButton from "./copy-button";

type PackageManager = "npm" | "yarn" | "bun" | "pnpm";

interface CommandBlockProps {
  commands: string[];
}

const packageCommands: Record<PackageManager, string> = {
  npm: "npm install",
  yarn: "yarn add",
  bun: "bun add",
  pnpm: "pnpm add",
};

function CommandBlock({ commands }: CommandBlockProps) {
  const [packageManager, setPackageManager] = useState<PackageManager>("pnpm");

  return (
    <Tabs
      defaultValue="npm"
      value={packageManager}
      onValueChange={(value) => setPackageManager(value as PackageManager)}
    >
      <div className="dark:bg-primary-foreground group mt-2 flex flex-col rounded-[8px] bg-[#F5F5F5] p-1">
        <div className="flex flex-row items-center justify-between pr-1 pl-2">
          <TabsList>
            <TabsTrigger
              className="flex items-center h-5! gap-2 px-1.5 hover:bg-transparent! data-[state=active]:text-[#C3292F]"
              value="npm"
            >
              <NpmIcon width="12" height="12" className="shrink-0 overflow-hidden" />
              npm
            </TabsTrigger>
            <TabsTrigger
              className="flex items-center h-5! gap-2 px-1.5 hover:bg-transparent! data-[state=active]:text-[#3592BD]"
              value="yarn"
            >
              <YarnIcon width="12" height="12" className="shrink-0 overflow-hidden" />
              yarn
            </TabsTrigger>
            <TabsTrigger
              className="flex items-center data-[state=active]:text-primary h-5! gap-2 px-1.5 hover:bg-transparent!"
              value="bun"
            >
              <BunIcon width="12" height="12" className="shrink-0 overflow-hidden" />
              bun
            </TabsTrigger>
            <TabsTrigger
              className="flex items-center h-5! gap-2 px-1.5 hover:bg-transparent! data-[state=active]:text-[#FAAF18]"
              value="pnpm"
            >
              <PnpmIcon width="12" height="12" className="shrink-0 overflow-hidden" />
              pnpm
            </TabsTrigger>
          </TabsList>
          <CopyButton code={packageCommands[packageManager] + " " + commands.join(" ")} />
        </div>
        <div className="bg-background text-muted-foreground rounded-[5px] border p-3 text-[13px]">
          {Object.keys(packageCommands).map((manager) => (
            <TabsContent className="font-mono" key={manager} value={manager}>
              {packageCommands[packageManager]} {commands.join(" ")}
            </TabsContent>
          ))}
        </div>
      </div>
    </Tabs>
  );
}

export { CommandBlock };
