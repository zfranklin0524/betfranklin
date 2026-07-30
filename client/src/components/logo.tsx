export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      aria-label="betFranklin logo"
    >
      {/* Outer shield */}
      <path
        d="M16 2 L28 5.5 V15 C28 21.8 22.8 27 16 29.5 C9.2 27 4 21.8 4 15 V5.5 Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Inner shield frame (heritage double-border) */}
      <path
        d="M16 4.6 L25.6 7.4 V15 C25.6 20.5 21.3 24.8 16 27 C10.7 24.8 6.4 20.5 6.4 15 V7.4 Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
        opacity="0.55"
      />
      {/* 3W monogram — bold collegiate */}
      <path
        d="M9.4 11.6 H14.6 L12.6 14.4 C14.4 14.5 15.8 15.9 15.8 17.7 C15.8 19.5 14.2 20.9 12.3 20.9 C10.6 20.9 9.3 19.9 8.8 18.6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.6 11.1 L18.6 19.8 L21.1 14.2 L23.6 19.8 L25.6 11.1"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
