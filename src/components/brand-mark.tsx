export function BrandMark({ boxClassName = "", size = 24 }: { boxClassName?: string; size?: number }) {
  return (
    <span className={`flex items-center justify-center rounded-lg bg-ink ${boxClassName}`}>
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: size, height: size }} aria-hidden="true">
        <path d="M4 21H9L12.5 15L16 19L21 9L24 13H28" stroke="var(--color-surface)" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" />
        <circle cx="21" cy="9" r="2.2" fill="var(--color-accent)" />
        <circle cx="28" cy="13" r="1.6" fill="var(--color-pos-bright)" />
      </svg>
    </span>
  );
}
