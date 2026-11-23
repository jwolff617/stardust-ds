// The spark: a smiling stick figure giving off light, with the three
// words around it. Shown in the rectangle before login.
export function Spark() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-6">
      <p className="text-lg text-[var(--muted)]">Feel your spark</p>
      <div className="flex items-center gap-6 sm:gap-10">
        <span className="text-sm text-[var(--muted)]">Love</span>
        <svg viewBox="0 0 120 160" className="h-28 w-24 text-[var(--muted)] sm:h-32 sm:w-28" aria-label="A smiling spark" role="img">
          {/* rays */}
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55">
            <line x1="60" y1="4" x2="60" y2="14" />
            <line x1="26" y1="16" x2="33" y2="23" />
            <line x1="94" y1="16" x2="87" y2="23" />
            <line x1="12" y1="42" x2="22" y2="42" />
            <line x1="108" y1="42" x2="98" y2="42" />
            <line x1="22" y1="70" x2="30" y2="65" />
            <line x1="98" y1="70" x2="90" y2="65" />
          </g>
          {/* head and smile */}
          <circle cx="60" cy="42" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="53" cy="38" r="2" fill="currentColor" />
          <circle cx="67" cy="38" r="2" fill="currentColor" />
          <path d="M50 47 Q60 56 70 47" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          {/* body, arms up in joy, legs */}
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
            <line x1="60" y1="62" x2="60" y2="112" />
            <line x1="60" y1="78" x2="34" y2="60" />
            <line x1="60" y1="78" x2="86" y2="60" />
            <line x1="60" y1="112" x2="42" y2="150" />
            <line x1="60" y1="112" x2="78" y2="150" />
          </g>
        </svg>
        <span className="text-sm text-[var(--muted)]">Spirit</span>
      </div>
    </div>
  );
}
