// Navigation commits immediately and the layout (sidebar, top bar) stays on
// screen; each page draws its own skeletons once its code arrives. Until
// then this shows a thin bar (after a beat, so quick navigations show
// nothing) and, if the load stalls, a way to reload.
export { RouteLoading as default } from "@/components/dashboard/RouteLoading";
