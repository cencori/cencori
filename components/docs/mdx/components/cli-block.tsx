"use client";

import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@/components/ui/base-ui-tab";
import { NpmIcon, YarnIcon, BunIcon, PnpmIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";
import { useState } from "react";
import CopyButton from "./copy-button";

type PackageManager = "npm" | "yarn" | "bun" | "pnpm";

interface CliBlockProps {
  commands: string[];
}

const packageCommands: Record<PackageManager, string> = {
  npm: "npx shadcn@latest add",
  yarn: "yarn shadcn@latest add",
  bun: "bunx --bun shadcn@latest add",
  pnpm: "pnpm dlx shadcn@latest add",
};

function CliBlock({ commands }: CliBlockProps) {
  const [packageManager, setPackageManager] = useState<PackageManager>("pnpm");

  return (
    <Tabs
      defaultValue="npm"
      value={packageManager}
      onValueChange={(value) => setPackageManager(value as PackageManager)}
    >
      <div className="dark:bg-primary-foreground group mt-2 flex flex-col rounded-xl bg-[#F5F5F5] p-1">
        <div className="flex flex-row items-center justify-between pr-1 pl-2">
          <TabsList
            variant="underline"
            indicatorClassName={cn(
              packageManager === "npm" && "bg-[#C3292F]!",
              packageManager === "yarn" && "bg-[#3592BD]!",
              packageManager === "bun" && "bg-primary!",
              packageManager === "pnpm" && "bg-[#FAAF18]!",
            )}
          >
            <TabsTab
              className="flex items-center h-5! gap-2 px-1.5 hover:bg-transparent! data-active:text-[#C3292F]"
              value="npm"
            >
              <NpmIcon className="size-3" />
              npm
            </TabsTab>
            <TabsTab
              className="flex items-center h-5! gap-2 px-1.5 hover:bg-transparent! data-active:text-[#3592BD]"
              value="yarn"
            >
              <YarnIcon className="size-3" />
              yarn
            </TabsTab>
            <TabsTab
              className="flex items-center data-active:text-primary h-5! gap-2 px-1.5 hover:bg-transparent!"
              value="bun"
            >
              <BunIcon className="size-3" />
              bun
            </TabsTab>
            <TabsTab
              className="flex items-center h-5! gap-2 px-1.5 hover:bg-transparent! data-active:text-[#FAAF18]"
              value="pnpm"
            >
              <PnpmIcon className="size-3" />
              pnpm
            </TabsTab>
          </TabsList>
          <CopyButton
            className="-mt-1"
            code={packageCommands[packageManager] + " " + commands.join(" ")}
          />
        </div>
        <div className="bg-background text-muted-foreground rounded-[5px] border p-3 text-[13px]">
          {Object.keys(packageCommands).map((manager) => (
            <TabsPanel className="font-mono" key={manager} value={manager}>
              {packageCommands[packageManager]} {commands.join(" ")}
            </TabsPanel>
          ))}
        </div>
      </div>
    </Tabs>
  );
}

export { CliBlock };
