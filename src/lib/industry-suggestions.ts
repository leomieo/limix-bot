export type IndustrySuggestion = "department" | "team" | "support";

const eventName = "limix:open-industry-templates";
type GalleryRequest = { kind: IndustrySuggestion; trigger?: HTMLButtonElement };

export function openIndustrySuggestions(kind: IndustrySuggestion, trigger?: HTMLButtonElement) {
  window.dispatchEvent(new CustomEvent<GalleryRequest>(eventName, { detail: { kind, trigger } }));
}

export function onIndustrySuggestions(open: (request: GalleryRequest) => void) {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<GalleryRequest>).detail;
    if (detail && ["department", "team", "support"].includes(detail.kind)) open(detail);
  };
  window.addEventListener(eventName, handler);
  return () => window.removeEventListener(eventName, handler);
}
