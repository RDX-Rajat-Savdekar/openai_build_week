import { brandIconUrl } from "@/lib/icons";
import {
  brandAssets,
  brandSizes,
  lockupForTheme,
  marketingLockup,
  type LockupVariant,
} from "@/lib/brand";
import { useTheme } from "@/context/ThemeProvider";
import { cn } from "@/lib/cn";
import { useEffect, useState } from "react";

export function BrandIcon({
  name,
  alt,
  size = 28,
  className,
}: {
  name: string;
  alt?: string;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={brandIconUrl(name)}
      alt={alt ?? name}
      width={size}
      height={size}
      loading="lazy"
      className={cn(
        "rounded-md border border-border bg-panel-2 object-contain p-1 flex-none",
        className,
      )}
    />
  );
}

function usePrefersDark(): boolean {
  const { theme } = useTheme();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (theme === "dark") {
      setDark(true);
      return;
    }
    if (theme === "light") {
      setDark(false);
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [theme]);

  return dark;
}

/** Square logomark — sidebar, favicon-style placements */
export function StitchLogomark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={brandAssets.logomark}
      alt="Stitch"
      width={size}
      height={size}
      className={cn("flex-none object-contain", className)}
      draggable={false}
    />
  );
}

/**
 * Full lockup (icon + wordmark).
 * `tone`: `light` = light-colored logo for dark backgrounds;
 *         `dark` = dark-colored logo for light backgrounds;
 *         `auto` = follow app theme.
 */
export function StitchLockup({
  variant = "horizontal",
  height = brandSizes.sidebar,
  className,
  tone = "auto",
}: {
  variant?: LockupVariant;
  height?: number;
  className?: string;
  tone?: "auto" | "light" | "dark";
}) {
  const isDark = usePrefersDark();
  const src =
    tone === "light"
      ? marketingLockup()
      : tone === "dark"
        ? brandAssets.lockupLightUi
        : lockupForTheme(variant, isDark);

  return (
    <img
      src={src}
      alt="Stitch"
      height={height}
      className={cn("h-auto w-auto max-w-none object-contain object-left", className)}
      style={{ height }}
      draggable={false}
    />
  );
}
