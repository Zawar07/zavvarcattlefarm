'use client';

/**
 * Horizontally scrollable row for filter pills (category, animal type, etc.).
 */
export default function FilterScroll({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`filter-scroll-wrap ${className}`.trim()}>
      <div className="scroll-x no-scrollbar" role="group">
        {children}
      </div>
    </div>
  );
}
