"use client";

import {
  HouseIcon,
  AddMagicIcon,
  SquareAddonIcon,
  BookIcon,
  ShapesIcon,
  InfoIcon,
  ChartConfigIcon,
  BarChartIcon,
} from "@/assets/icons";

type IconComponent = React.FC<{ width?: string | number; height?: string | number; className?: string }>;

const ICON_MAP: Record<string, IconComponent> = {
  // Get Started (root pages)
  "get-started": HouseIcon,
  overview: HouseIcon,
  introduction: HouseIcon,
  "quick-start": AddMagicIcon,
  installation: SquareAddonIcon,
  // Folders
  ai: BarChartIcon,
  api: ChartConfigIcon,
  "getting-started": BookIcon,
  guides: BookIcon,
  hackathons: AddMagicIcon,
  integrations: SquareAddonIcon,
  platform: ShapesIcon,
  security: InfoIcon,
};

export function getNavItemIcon(key: string, className = "size-4 shrink-0") {
  const norm = key.toLowerCase().replace(/\s+/g, "-");
  const Icon = ICON_MAP[norm] ?? BookIcon;
  return <Icon className={className} />;
}
