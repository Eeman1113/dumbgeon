/**
 * The CRT simulation layer: scanlines, aperture-grille striping, a rolling
 * scan sweep, and edge vignette. Purely decorative, so it sits above the
 * content and ignores pointer events entirely.
 */
export default function Crt() {
  return (
    <>
      <div className="crt-sweep" aria-hidden="true" />
      <div className="crt-vignette" aria-hidden="true" />
      <div className="crt-scanlines" aria-hidden="true" />
    </>
  );
}
