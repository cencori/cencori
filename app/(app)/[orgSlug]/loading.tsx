// Navigation commits immediately and the layout (sidebar, top bar) stays on
// screen; each page renders its own UI and skeletons only where data is still
// loading. This boundary deliberately draws nothing so there's no generic
// page-shaped placeholder flashing in between.
export default function RouteLoading() {
    return null;
}
