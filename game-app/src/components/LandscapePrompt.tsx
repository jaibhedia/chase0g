import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Smartphone, RotateCw } from 'lucide-react';

export default function LandscapePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const checkOrientation = () => {
      // Phones + tablets (incl. iPads that UA-report as "Macintosh") expose a coarse
      // primary pointer; only prompt those, and only while held in portrait.
      const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints ?? 0) > 0;
      const isPortrait = window.innerHeight > window.innerWidth;
      setShowPrompt(coarse && hasTouch && isPortrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    const mq = window.matchMedia?.('(pointer: coarse)');
    mq?.addEventListener?.('change', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      mq?.removeEventListener?.('change', checkOrientation);
    };
  }, []);

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-[#11111c] px-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="px-panel px-6 py-6 sm:px-10 sm:py-8 text-center max-w-sm">
          <motion.div
            animate={reduce ? undefined : { rotate: [0, 90, 90, 0] }}
            transition={reduce ? undefined : { duration: 2, repeat: Infinity, ease: 'easeInOut', times: [0, 0.4, 0.6, 1] }}
            className="mb-5 inline-block"
          >
            <Smartphone className="w-16 h-16 sm:w-20 sm:h-20 text-[#ffc93c]" aria-hidden="true" />
          </motion.div>
          <h2 className="px-heading text-base sm:text-lg text-[#ffc93c] mb-3" style={{ textShadow: '3px 3px 0 #11111c' }}>
            Rotate your device
          </h2>
          <p className="px-body text-[#f4e7c3] text-lg sm:text-xl mb-6">
            Chase plays best in landscape.
          </p>
          <div className="flex items-center justify-center gap-3" aria-hidden="true">
            <div className="w-12 h-16 border-[3px] border-[#11111c] bg-[#4d2813] flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-[#f4e7c3]" />
            </div>
            <RotateCw className="w-5 h-5 text-[#6ab04c]" />
            <div className="w-16 h-12 border-[3px] border-[#11111c] bg-[#6ab04c]/30 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-[#6ab04c] rotate-90" />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
