import { cn } from "@/lib/cn";
import { type ButtonHTMLAttributes } from "react";

type Variant = "solid" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}

const variants: Record<Variant, string> = {
  solid: "border-accent bg-accent text-white hover:opacity-90",
  ghost: "border-border bg-transparent text-text-2 hover:bg-accent-soft hover:text-accent hover:border-accent",
  danger: "border-critical bg-transparent text-critical hover:bg-critical-soft",
};

const sizes = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
  lg: "px-5 py-3 text-base",
};

export function Button({
  className,
  variant = "ghost",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
