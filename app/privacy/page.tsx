import type { Metadata } from 'next';
import { LegalLayout, LegalHeading } from '../components/LegalLayout';
import { siteConfig } from '../siteConfig';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${siteConfig.name} handles your data: no accounts, transient multiplayer data, cookieless analytics, and peer-to-peer voice that is never recorded.`,
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="June 3, 2026">
      <p>
        {siteConfig.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a free browser game. We keep data
        collection to the minimum needed to run multiplayer matches. You do not need an account to
        play. This policy explains what we process and why.
      </p>

      <LegalHeading>What we process</LegalHeading>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-[#FFC93C]">Display name &amp; character.</strong> The name and
          character you choose are shown to other players in your room and relayed through our
          multiplayer server. This is held in server memory only and is cleared when the room ends.
        </li>
        <li>
          <strong className="text-[#FFC93C]">In-match data.</strong> Your position, movement and
          power-up usage are relayed in real time to other players in your room so the game stays in
          sync. It is not stored after the match.
        </li>
        <li>
          <strong className="text-[#FFC93C]">Local browser storage.</strong> We store a randomly
          generated player ID and your game settings (such as sound and last-used character) in your
          browser&rsquo;s <code>localStorage</code>. This never leaves your device and is not a login.
        </li>
        <li>
          <strong className="text-[#FFC93C]">Voice chat (optional).</strong> If you join proximity
          voice, audio is streamed peer-to-peer between players over WebRTC. We do not record, store
          or listen to voice; our server only helps players find each other to connect.
        </li>
        <li>
          <strong className="text-[#FFC93C]">Gameplay stats (optional).</strong> If enabled, aggregate
          stats such as wins, tags and power-up usage may be saved to our database to power
          leaderboards. These are tied to your generated player ID, not to your real identity.
        </li>
        <li>
          <strong className="text-[#FFC93C]">Analytics.</strong> We use Vercel Web Analytics, which is
          cookieless and privacy-friendly. It collects anonymous, aggregated metrics (like page views
          and country) and does not build personal profiles or track you across other sites.
        </li>
      </ul>

      <LegalHeading>Cookies</LegalHeading>
      <p>
        We do not use advertising or cross-site tracking cookies. The only persistent data is the
        gameplay <code>localStorage</code> described above, which you can clear at any time from your
        browser settings.
      </p>

      <LegalHeading>Third-party services</LegalHeading>
      <p>
        We rely on a few providers to host and run the game: Vercel (hosting and analytics), Render
        (the real-time multiplayer server), and a managed database provider for optional stats. Your
        data is processed by these services only to deliver the game.
      </p>

      <LegalHeading>Children</LegalHeading>
      <p>
        The game is suitable for general audiences and is not directed at children under 13. Please
        do not include personal information in your display name or share it over voice chat.
      </p>

      <LegalHeading>Your choices</LegalHeading>
      <ul className="list-disc space-y-2 pl-5">
        <li>Use a nickname rather than your real name.</li>
        <li>Leave voice chat off — it is opt-in.</li>
        <li>Clear your browser&rsquo;s site data to remove your local player ID and settings.</li>
      </ul>

      <LegalHeading>Changes</LegalHeading>
      <p>
        We may update this policy as the game evolves. Material changes will be reflected by the
        &ldquo;Last updated&rdquo; date above.
      </p>

      <LegalHeading>Contact</LegalHeading>
      <p>
        Questions? Reach us on{' '}
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
