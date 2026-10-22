/** Minimal text logo: the name, then a terminal cursor. */
export default function Wordmark({ cursor = true }: { cursor?: boolean }) {
  return (
    <span className="wordmark">
      dumbgeon
      {cursor ? <i className="wordmark-cursor" aria-hidden="true" /> : null}
    </span>
  );
}
