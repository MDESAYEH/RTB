/** Original basketball seams and court markings: presentation only. */
export function BasketballGlyph({
  className = "",
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="50" cy="50" r="47" fill="currentColor" />
      <g fill="none" stroke="var(--ball-seam, #101b22)" strokeWidth="3.4">
        <circle cx="50" cy="50" r="47" />
        <path d="M3 50h94M50 3v94M17 15c47 19 47 51 0 70M83 15C36 34 36 66 83 85" />
      </g>
    </svg>
  );
}
export function CourtArc({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 700 700"
      fill="none"
      aria-hidden="true"
    >
      <path d="M10 690V350a340 340 0 0 1 680 0v340M220 690V350h260v340M275 350a75 75 0 0 0 150 0M330 610h40" />
      <circle cx="350" cy="590" r="18" />
    </svg>
  );
}
