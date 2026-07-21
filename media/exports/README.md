# Generated logo exports — complete kit

All Stitch brand assets live here. Regenerate SVG + sized PNGs + favicon with:

```bash
npm run media:build
```

## `gif/` — animated storyboard

| File | Use |
|------|-----|
| `stitch-logo-animation.gif` | Looping animation (~3.7s) |
| `stitch-logo-animation-once.gif` | Play once (splash) |
| `stitch-logo-animation-480.gif` | Smaller loop for README/social |
| `frames/frame-1..4.png` | Individual storyboard panels |

Rebuild: `npm run media:gif` — see [`../brand/motion-guide.md`](../brand/motion-guide.md) for GIF vs Lottie guidance.

## `svg/` — vector masters (production use)

| File | Use |
|------|-----|
| `stitch-logomark.svg` | App icon, sidebar mark |
| `stitch-logo-primary.svg` | Main horizontal lockup |
| `stitch-logo-light.svg` | Light UI sidebar |
| `stitch-logo-dark.svg` | Dark UI sidebar |
| `stitch-logo-black.svg` | Print / legal |
| `stitch-logo-white.svg` | Dark overlays |
| `stitch-wordmark.svg` | Text-only |
| `stitch-vertical-lockup.svg` | Splash, mobile, swag |
| `stitch-watermark.svg` | Empty states, PDF backgrounds |

## `png/` — raster exports

### Sized logomark (from SVG — crisp at all scales)

| File | Size |
|------|------|
| `logomark-16.png` | 16×16 |
| `logomark-32.png` | 32×32 |
| `logomark-48.png` | 48×48 |
| `logomark-128.png` | 128×128 |
| `logomark-512.png` | 512×512 |
| `logomark-1024.png` | 1024×1024 |
| `avatar-1024.png` | alias of logomark-1024 |

### Checklist aliases (canonical names)

| File | Source |
|------|--------|
| `og-image.png` | AI marketing banner |
| `splash-1920x1080.png` | AI splash screen |
| `slack-bot-avatar.png` | AI Slack bot avatar |
| `marketplace-icon.png` | SVG logomark @ 512px |
| `horizontal-lockup.png` | AI horizontal lockup |
| `vertical-lockup.png` | AI vertical lockup |
| `social-avatar.png` | AI social avatar |

### AI-generated concept art (prompts 01–18)

| File | Prompt |
|------|--------|
| `stitch-logomark.png` | 02 logomark |
| `stitch-logo-primary.png` | 01 primary |
| `stitch-wordmark.png` | 03 wordmark |
| `stitch-horizontal-lockup.png` | 04 horizontal |
| `stitch-vertical-lockup.png` | 05 vertical |
| `stitch-favicon.png` | 06 favicon |
| `stitch-social-avatar.png` | 07 social |
| `stitch-og-image.png` | 08 OG |
| `stitch-logo-black.png` | 09 monochrome black |
| `stitch-logo-white.png` | 10 monochrome white |
| `stitch-logo-dark-ui.png` | 11 dark UI |
| `stitch-logo-light-ui.png` | 12 light UI |
| `stitch-email-logo.png` | 13 email |
| `stitch-slack-bot.png` | 14 Slack |
| `stitch-marketplace-icon.png` | 15 marketplace |
| `stitch-splash.png` | 16 splash |
| `stitch-watermark.png` | 17 watermark |
| `stitch-animation-storyboard.png` | 18 motion brief |

### SVG-derived PNGs (from `npm run media:build`)

| File | Notes |
|------|-------|
| `stitch-logomark-from-svg.png` | 512px, production icon |
| `stitch-logo-primary-from-svg.png` | 800×160 lockup |
| `stitch-wordmark-from-svg.png` | 720×192 |
| `stitch-vertical-lockup-from-svg.png` | 512×420 |
| `stitch-favicon-from-svg.png` | 32px |
| `stitch-marketplace-icon-from-svg.png` | 512px |
| `stitch-slack-bot-from-svg.png` | 512px |
| `avatar-1024-from-svg.png` | 1024px |

**Recommendation:** Use **SVG + `logomark-*.png`** in the product UI. Use **AI PNGs** for marketing hero/OG/splash where illustration richness helps.

## `favicon/`

| File | Notes |
|------|-------|
| `favicon.ico` | 16 + 32 multi-size ICO |
| `favicon-16.png` | Browser tab |
| `favicon-32.png` | Browser tab |
| `apple-touch-icon.png` | 180×180 iOS |

## Source files

- `../source/stitch-mark.svg` — hand-authored mark geometry
- `../scripts/build-assets.mjs` — SVG → PNG + ICO pipeline

## Quality checks

- [x] Logomark readable at 16×16 (`logomark-16.png`)
- [x] Horizontal lockup SVG export (`stitch-logo-primary.svg`)
- [x] Dark and light variants share geometry
- [x] `favicon.ico` generated
- [x] OG + splash marketing images present
