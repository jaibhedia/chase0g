'use client';

/**
 * Two slides, shown once, before a player picks a mode.
 *
 * People who watched the game cold read it as a racing game — the dinos run, there's a
 * timer, and nothing on screen says what winning means. The chase mechanic only becomes
 * legible after you've already lost once, which is too late when someone is giving you
 * thirty seconds of attention.
 *
 * The second slide is the stake, deliberately. The most common note on this project is
 * that the on-chain layer is invisible, and the honest fix is to say it in words before
 * the player is deep enough to have stopped looking for it.
 *
 * Shown once per browser and skippable. A player who already knows the rules should
 * never see this twice, so it must never become something to click through on the way
 * to a rematch.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Egg, Trophy } from 'lucide-react';

const SEEN_KEY = 'chase-how-to-play-seen';

const SLIDES = [
  {
    icon: Egg,
    title: 'Grab the egg',
    body: 'One egg. Everyone wants it. Whoever is holding it when the timer hits zero wins the round — so take it, and then survive being chased for it.',
  },
  {
    icon: Trophy,
    title: 'Winner takes the pot',
    body: 'Ranked matches escrow real USDC on Arc. Every player stakes, the pot builds, and the winner is paid out on-chain the moment the round ends. No claim step.',
  },
];

export function HowToPlay() {
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    // Read in an effect, not during render: localStorage doesn't exist during SSR, and
    // a first paint that disagrees with the client would hydrate-mismatch.
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      // Private mode or blocked storage. Showing the intro every time is worse than not
      // showing it, so treat an unreadable flag as "already seen".
    }
  }, []);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch { /* nothing to do — see above */ }
  };

  const next = () => (slide < SLIDES.length - 1 ? setSlide(slide + 1) : dismiss());

  if (!open) return null;

  const { icon: Icon, title, body } = SLIDES[slide];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      >
        <motion.div
          key={slide}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-8 pixel-panel text-center"
        >
          <Icon className="mx-auto mb-4 h-12 w-12 text-[#ffc93c]" aria-hidden />
          <h2 className="pixel-font mb-3 text-2xl font-bold text-[#f4e7c3]">{title}</h2>
          <p className="mb-8 text-sm leading-relaxed text-[#f4e7c3]/80">{body}</p>

          <div className="mb-6 flex justify-center gap-2" aria-hidden>
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className="h-2 w-2"
                style={{ background: i === slide ? '#ffc93c' : 'rgba(244,231,195,0.3)' }}
              />
            ))}
          </div>

          <button
            onClick={next}
            className="w-full bg-[#ffc93c] px-6 py-3 pixel-font font-bold text-[#1a1a1a] transition hover:brightness-110"
          >
            {slide < SLIDES.length - 1 ? 'Next' : "Let's play"}
          </button>
          <button
            onClick={dismiss}
            className="mt-3 w-full px-6 py-2 text-sm text-[#f4e7c3]/60 transition hover:text-[#f4e7c3]"
          >
            Skip
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
