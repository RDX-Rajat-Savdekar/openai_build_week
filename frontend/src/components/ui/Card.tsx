import { cn } from "@/lib/cn";
import { type HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-stitch border border-border bg-panel p-5 shadow-stitch transition-shadow duration-200 hover:shadow-lg",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("m-0 mb-1 text-base font-semibold", className)} {...props} />;
}

export function CardSub({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("m-0 mb-3.5 text-xs text-muted", className)} {...props} />;
}
