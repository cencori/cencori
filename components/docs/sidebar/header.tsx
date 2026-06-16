import { SidebarHeader, SidebarTrigger } from "@/components/ui/sidebar";
import ThemeSwitcher from "./theme-switcher";

const DocsHeader = () => {
  return (
    <SidebarHeader className="bg-background pointer-events-none fixed top-0 z-50 flex h-14 w-full flex-row justify-between border-b p-0 sm:sticky sm:h-[35px] sm:border-b-0 sm:bg-transparent">
      <div className="pointer-events-auto flex items-center pl-3">
        <SidebarTrigger className="sidebar:hidden" />
      </div>
      <div className="pointer-events-auto relative z-10 flex h-full items-center gap-2 pr-3 pl-6">
        <ThemeSwitcher />
      </div>
    </SidebarHeader>
  );
};

export default DocsHeader;
