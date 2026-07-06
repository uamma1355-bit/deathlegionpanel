/**
 * ContentContainer — verbatim port of upstream.
 * max-width 1200px, mx-4 on small screens, mx-auto on xl.
 */
export function ContentContainer({ children, className = '' }: { children: React.ReactNode; className?: string }): JSX.Element {
  return <div className={`mx-4 xl:mx-auto ${className}`} style={{ maxWidth: 1200 }}>{children}</div>;
}
