'use client';

/**
 * Horizontally scrollable table wrapper for mobile layouts.
 */
export default function ScrollableTable({
  children,
  minWidth = 580,
  className = '',
}: {
  children: React.ReactNode;
  minWidth?: number;
  className?: string;
}) {
  return (
    <div className={`table-scroll ${className}`.trim()}>
      <table className="w-full border-collapse" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}
