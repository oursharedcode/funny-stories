// SPDX-License-Identifier: AGPL-3.0-only

// Optional deployer branding overlaid on generated pictures (spec §25).
// The image is a bundled asset at /deployer-logo.png — shipped at 25×25
// pixels by default. An operator brands their instance by replacing
// `client/public/deployer-logo.png` with their own 25×25 PNG and
// rebuilding. The stamp is rendered at native 25×25 size (no CSS
// upscaling) so the deployer's pixel-level branding is preserved.
//
// This is a display-only overlay; it is not baked into the picture's
// pixels. Render it as a child of a `position: relative` container
// holding the picture.
export default function LogoStamp() {
  return (
    <img
      src="/deployer-logo.png"
      alt=""
      aria-hidden="true"
      width={25}
      height={25}
      className="pointer-events-none absolute bottom-2 right-2 opacity-80"
    />
  );
}
