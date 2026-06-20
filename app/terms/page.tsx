import type { Metadata } from 'next';
import { LegalLayout, LegalHeading } from '../components/LegalLayout';
import { siteConfig } from '../siteConfig';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: `The terms for playing ${siteConfig.name}: acceptable use, fair play, voice-chat conduct, intellectual property, and disclaimers.`,
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms & Conditions" updated="June 3, 2026">
      <p>
        Welcome to {siteConfig.name}. By playing the game you agree to these Terms. If you do not
        agree, please do not use the game.
      </p>

      <LegalHeading>License to play</LegalHeading>
      <p>
        We grant you a free, personal, non-exclusive, non-transferable license to play the game for
        your own entertainment. The game is provided at no cost and we may change, suspend or
        discontinue any part of it at any time.
      </p>

      <LegalHeading>Fair play &amp; acceptable use</LegalHeading>
      <ul className="list-disc space-y-2 pl-5">
        <li>Do not cheat, exploit bugs, or use bots, scripts or modified clients.</li>
        <li>Do not disrupt, overload, or attempt to gain unauthorized access to our servers.</li>
        <li>Do not harvest data from the game or other players.</li>
      </ul>

      <LegalHeading>Conduct &amp; user content</LegalHeading>
      <p>
        You are responsible for the display name you choose and anything you say over voice chat. Do
        not use names or speech that are hateful, harassing, threatening, obscene, or that impersonate
        others. We may filter, remove, or block content and players that violate these Terms.
      </p>

      <LegalHeading>Intellectual property</LegalHeading>
      <p>
        The game, including its code, artwork, characters, audio and design, is owned by us or our
        licensors and is protected by intellectual-property laws. You may not copy, redistribute,
        sell, or create derivative works from it without our permission.
      </p>

      <LegalHeading>No warranty</LegalHeading>
      <p>
        The game is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of
        any kind. It runs on hosted infrastructure and may be unavailable, interrupted, or laggy at
        times. We do not guarantee uninterrupted or error-free play.
      </p>

      <LegalHeading>Limitation of liability</LegalHeading>
      <p>
        To the fullest extent permitted by law, we are not liable for any indirect, incidental, or
        consequential damages arising from your use of (or inability to use) the game. The game is
        offered free of charge.
      </p>

      <LegalHeading>Changes to these Terms</LegalHeading>
      <p>
        We may update these Terms from time to time. Continued play after changes take effect means
        you accept the updated Terms. The &ldquo;Last updated&rdquo; date above reflects the current
        version.
      </p>

      <LegalHeading>Contact</LegalHeading>
      <p>
        Questions about these Terms? Reach us on{' '}
        <a
          href={siteConfig.socials.x}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5FCDE4] underline hover:text-[#FFC93C]"
        >
          X
        </a>{' '}
        or{' '}
        <a
          href={siteConfig.socials.telegram}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5FCDE4] underline hover:text-[#FFC93C]"
        >
          Telegram
        </a>
        .
      </p>
    </LegalLayout>
  );
}
