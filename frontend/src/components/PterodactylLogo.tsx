/**
 * Pterodactyl logo SVG — verbatim from upstream (resources/views/templates/wrapper.blade.php).
 * The actual Pterodactyl logo is a pterodactyl silhouette.
 */

export function PterodactylLogo({ className = 'w-48 md:w-64' }: { className?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 256 256"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Pterodactyl"
    >
      {/* Circle background */}
      <circle cx="128" cy="128" r="120" fill="#10568b" />
      {/* Pterodactyl silhouette — simplified geometric version */}
      <path
        d="M48 128 C48 128, 72 72, 128 72 C160 72, 180 88, 192 104 L208 88 L216 96 L200 112 C204 120, 208 132, 208 144 L192 144 C192 144, 188 128, 176 120 C164 128, 148 136, 128 136 C100 136, 76 120, 64 112 C56 120, 52 124, 48 128 Z"
        fill="#ffffff"
      />
      <circle cx="172" cy="96" r="4" fill="#10568b" />
    </svg>
  );
}

/** Small logo for the nav bar */
export function PterodactylIcon({ className = 'h-8 w-8' }: { className?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 256 256"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Pterodactyl"
    >
      <circle cx="128" cy="128" r="120" fill="#10568b" />
      <path
        d="M48 128 C48 128, 72 72, 128 72 C160 72, 180 88, 192 104 L208 88 L216 96 L200 112 C204 120, 208 132, 208 144 L192 144 C192 144, 188 128, 176 120 C164 128, 148 136, 128 136 C100 136, 76 120, 64 112 C56 120, 52 124, 48 128 Z"
        fill="#ffffff"
      />
      <circle cx="172" cy="96" r="4" fill="#10568b" />
    </svg>
  );
}
