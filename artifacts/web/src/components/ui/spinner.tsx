import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface SpinnerProps extends React.HTMLAttributes<SVGSVGElement> {
  size?: 'sm' | 'default' | 'lg';
}

const sizeClasses = {
  sm: 'h-4 w-4',
  default: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const;

const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, size = 'default', ...props }, ref) => {
    return (
      <Loader2
        ref={ref}
        className={cn('animate-spin text-muted-foreground', sizeClasses[size], className)}
        aria-label="Loading"
        role="status"
        {...props}
      />
    );
  }
);
Spinner.displayName = 'Spinner';

export { Spinner };
