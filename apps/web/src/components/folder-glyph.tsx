export function FolderGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 64 50">
      <path
        d="M3 7.5A4.5 4.5 0 0 1 7.5 3h14.6a4.5 4.5 0 0 1 3.2 1.3L29 8h27.5a4.5 4.5 0 0 1 4.5 4.5V18H3z"
        fill="var(--folder-back)"
      />
      <rect
        fill="var(--folder-front)"
        height="36"
        rx="4"
        width="58"
        x="3"
        y="11"
      />
      <rect
        fill="var(--folder-shine)"
        height="1.5"
        rx="0.75"
        width="54"
        x="5"
        y="12.5"
      />
    </svg>
  );
}
