"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiBrain01Icon,
  ApiIcon,
  Rocket01Icon,
  Flag01Icon,
  Download04Icon,
  BookOpen01Icon,
  Award01Icon,
  PlugSocketIcon,
  Layers01Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons";

// Maps a docs nav key (root page slug or folder name) → a HugeIcons icon.
const ICON_MAP: Record<string, typeof AiBrain01Icon> = {
  // Get Started (root pages)
  introduction: Rocket01Icon,
  "quick-start": Flag01Icon,
  installation: Download04Icon,
  // Folders
  ai: AiBrain01Icon,
  api: ApiIcon,
  "getting-started": BookOpen01Icon,
  guides: BookOpen01Icon,
  hackathons: Award01Icon,
  integrations: PlugSocketIcon,
  platform: Layers01Icon,
  security: Shield01Icon,
};

export function getNavItemIcon(key: string, className = "size-4 shrink-0") {
  const norm = key.toLowerCase().replace(/\s+/g, "-");
  const icon = ICON_MAP[norm] ?? BookOpen01Icon;
  return <HugeiconsIcon icon={icon} className={className} />;
}
