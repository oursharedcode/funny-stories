# Customization

## Stamping your logo on pictures

To brand the cartoons your instance generates, replace `client/public/deployer-logo.png` with your own **25×25 pixel PNG** and rebuild. It appears as a small (25×25) semi-transparent stamp in the bottom-right corner of every generated picture — on the reveal screen and in the room gallery.

The bundled default is a 25×25 downscale of the app icon, so a fresh deployment already carries a small visible stamp out of the box. If you want **no stamp at all**, either delete `client/public/deployer-logo.png` or replace it with a 25×25 fully transparent PNG.

The stamp is rendered at native 25×25 pixels (no CSS upscaling), so your pixel-level branding survives intact. The size is locked at 25×25 — a larger source PNG will be downscaled by the browser. If you want a different size, change both `client/public/deployer-logo.png` and the `width`/`height` attributes in [`client/src/components/LogoStamp.tsx`](../client/src/components/LogoStamp.tsx) in lockstep.

The stamp is a display overlay; it is not baked into the image pixels.

## If you fork or rebrand this repo

The in-game footer points at the upstream repo by default. If you ship a substantively modified fork, change the constant in [`client/src/sourceUrl.ts`](../client/src/sourceUrl.ts) so your players land on your fork instead — AGPL §13 expects the *running* deployment's source to be reachable from the running deployment, not the unmodified upstream.

## A note on README screenshots

If you build your own README around a fork: **do not put real political figures, real children, or real celebrities into your gallery screenshots**. They become the GitHub social-card preview and the Twitter/Mastodon link card whether you want them to or not. The upstream README follows the same rule and you should too.
