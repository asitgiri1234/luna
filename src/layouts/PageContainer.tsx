import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageContainerProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Standard scaffold for full-height pages: sticky-feeling header with
 * title/description/actions, scrollable content below.
 */
export function PageContainer({
  title,
  description,
  actions,
  children,
  className,
}: PageContainerProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-start justify-between gap-4 px-8 pt-8 pb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto px-8 pb-8", className)}>
        {children}
      </div>
    </div>
  );
}
