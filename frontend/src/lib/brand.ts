/** Brand asset paths — files in `media/exports/png/` (served at `/media/exports/png`). */

const PNG = "/media/exports/png";

export const brandAssets = {
  logomark: `${PNG}/stitch-logomark.png`,
  /** Dark wordmark — for light backgrounds */
  lockupPrimary: `${PNG}/stitch-logo-primary.png`,
  lockupLightUi: `${PNG}/stitch-logo-light-ui.png`,
  /** White wordmark + pale icon — for dark backgrounds */
  lockupDarkUi: `${PNG}/stitch-logo-dark-ui.png`,
  logoWhite: `${PNG}/stitch-logo-white.png`,
  logoBlack: `${PNG}/stitch-logo-black.png`,
  horizontal: `${PNG}/stitch-horizontal-lockup.png`,
  vertical: `${PNG}/stitch-vertical-lockup.png`,
  favicon: `${PNG}/stitch-favicon.png`,
  og: `${PNG}/stitch-og-image.png`,
} as const;

/** @deprecated use lockupLightUi / lockupDarkUi */
export const lockupLight = brandAssets.lockupLightUi;
/** @deprecated use lockupDarkUi */
export const lockupDark = brandAssets.lockupDarkUi;

export type LockupVariant = "horizontal" | "vertical" | "primary";

/** Background the logo sits on — picks the readable artwork variant. */
export type LogoSurface = "dark" | "light";

export const brandSizes = {
  nav: 56,
  footer: 48,
  auth: 56,
  sidebar: 36,
} as const;

export function lockupForSurface(variant: LockupVariant, surface: LogoSurface): string {
  if (surface === "dark") {
    return brandAssets.lockupDarkUi;
  }
  if (variant === "vertical") return brandAssets.vertical;
  if (variant === "primary") return brandAssets.lockupPrimary;
  return brandAssets.lockupLightUi;
}

export function lockupForTheme(variant: LockupVariant, isDark: boolean): string {
  return lockupForSurface(variant, isDark ? "dark" : "light");
}

/** Marketing + auth on dark panels — white wordmark lockup */
export function marketingLockup(): string {
  return brandAssets.lockupDarkUi;
}
