/** Zalo-style chat bubble in the current text colour (Limix Bot: the feedback link opens the owner's Zalo). */
export function ZaloIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d="M12 2.5C6.48 2.5 2 6.41 2 11.25c0 2.42 1.12 4.6 2.93 6.18-.12 1.27-.5 2.4-1.2 3.32a.5.5 0 0 0 .55.78c1.77-.33 3.2-1.07 4.23-1.88 1.05.31 2.2.48 3.49.48 5.52 0 10-3.91 10-8.88S17.52 2.5 12 2.5Zm-4.5 5.6h4.6c.55 0 .8.67.4 1.05L9.4 11.7h2.7c.4 0 .7.3.7.7s-.3.7-.7.7H7.5c-.55 0-.8-.67-.4-1.05l3.1-2.55H7.5a.7.7 0 0 1 0-1.4Zm8.2 0c.4 0 .7.3.7.7v3.6a.7.7 0 0 1-1.4 0V8.8c0-.4.3-.7.7-.7Zm-2.3.9a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2Z"/>
    </svg>
  );
}
