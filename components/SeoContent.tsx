import { SITE } from "@/lib/site";

/**
 * Descriptive content for screen readers and crawlers.
 *
 * This is visually hidden but genuinely available to assistive technology —
 * the game itself is a canvas of streaming prose with no stable headings, so
 * without this a screen reader (and a crawler) gets almost nothing. Every
 * claim here is true of the page. It is not keyword-stuffed filler shown only
 * to robots, which search engines penalise and which would be useless to the
 * people the markup is supposed to help.
 */
export default function SeoContent() {
  return (
    <section className="sr-only" aria-label="About this game">
      <h1>dumbgeon — a free AI text adventure that runs entirely in your browser</h1>

      <p>{SITE.description}</p>

      <h2>What it is</h2>
      <p>
        dumbgeon is an AI-powered interactive fiction game in the tradition of AI Dungeon
        and classic text adventures like Zork. You are dropped into a world and type
        whatever you want to do in plain English. The story is improvised in response,
        one beat at a time, and no two playthroughs are the same.
      </p>

      <h2>How it is different</h2>
      <p>
        The language model runs on your own device through Chrome&apos;s built-in Gemini
        Nano, so the game is free forever, works offline once the model is cached, and
        never transmits a word of your story anywhere. There is no account, no API key,
        no subscription and no server.
      </p>
      <p>
        A story director tracks dramatic tension, a ticking deadline, an antagonist with
        its own goals, and every unresolved question the plot has raised. Actions can
        fail, cost you an item, or wound you. That structure is what keeps an improvised
        story escalating instead of wandering.
      </p>

      <h2>Requirements</h2>
      <p>
        Desktop Google Chrome 138 or newer with the built-in Gemini Nano model enabled,
        about 22 GB of free disk space, and more than 4 GB of video memory. Chrome
        downloads the model once, then the game runs locally.
      </p>

      <h2>Frequently asked questions</h2>
      <h3>Is dumbgeon free?</h3>
      <p>
        Yes, entirely. Because the model runs on your hardware there is no inference cost
        to pass on.
      </p>
      <h3>Is my story private?</h3>
      <p>
        Yes. Everything is computed in your browser and saves are kept in your
        browser&apos;s local storage. Nothing is uploaded.
      </p>
      <h3>Can I play dumbgeon offline?</h3>
      <p>
        Yes, once Chrome has downloaded the on-device model the game needs no network
        connection.
      </p>
      <h3>Is this the same as AI Dungeon?</h3>
      <p>
        It is the same idea executed locally: an open-ended text adventure driven by a
        language model, but free, private, and structured by a story director.
      </p>

      <p>
        Open source. Source code at <a href={SITE.repo}>{SITE.repo}</a>. Built by{" "}
        <a href={SITE.authorUrl}>{SITE.author}</a>.
      </p>
    </section>
  );
}
