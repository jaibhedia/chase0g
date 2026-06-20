import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, ArrowRight } from 'lucide-react';

export default function LandscapePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

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
        className="fixed inset-0 z-[100] bg-gradient-to-br from-violet-950 via-slate-950 to-cyan-950 flex items-center justify-center"
      >
        <div className="text-center px-8">
          <motion.div
            animate={{ rotate: 90 }}
            transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
            className="mb-8"
          >
            <Smartphone className="w-24 h-24 text-fuchsia-600 mx-auto" />
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-4">Please Rotate Your Device</h2>
          <p className="text-violet-200 text-lg">This game is best played in landscape mode</p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <div className="w-16 h-24 border-4 border-fuchsia-500 rounded-lg flex items-center justify-center bg-violet-950/55">
              <Smartphone className="w-7 h-7 text-fuchsia-500" />
            </div>
            <ArrowRight className="w-6 h-6 text-white" />
            <div className="w-24 h-16 border-4 border-cyan-500 rounded-lg flex items-center justify-center bg-cyan-950/45">
              <Smartphone className="w-7 h-7 text-cyan-500 rotate-90" />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
