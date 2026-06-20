import { motion } from 'framer-motion';
import { Volume2, VolumeX, Menu, Egg, Music } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { audioManager } from '@/utils/audioManager';
import { PowerUpHudCluster } from '@/components/PowerUpHudCluster';
import { Minimap } from '@/components/Minimap';

function formatMatchTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// Readable label + color per 0G-chosen tactic, for the "0G Agents" HUD panel.
const MODE_LABEL: Record<string, string> = {
  hunt: 'HUNTING', intercept: 'CUTTING OFF', guard: 'GUARDING', flee: 'FLEEING', roam: 'ROAMING',
};
const MODE_COLOR: Record<string, string> = {
  hunt: '#f87171', intercept: '#fb923c', guard: '#5fcde4', flee: '#facc15', roam: '#9fb0d8',
};

export default function GameHUD() {
  const { players, userId, timeRemaining, selectedCharacter, setPaused, ogStatus } = useGameStore();
  const [muted, setMuted] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const agents = players.filter((p) => p.isBot);

  const currentPlayer = players.find(
    (p) => p.userId === userId || (!p.isBot && players.length > 0)
  );
  const hasEgg = currentPlayer?.hasEgg ?? false;
  const eggHolder = players.find((p) => p.hasEgg);
  const eggOnGround = !eggHolder;
  const powerUpReady = currentPlayer?.powerUpReady ?? false;
  const powerUpActive = currentPlayer?.powerUpActive ?? false;
  const powerUpCooldown = currentPlayer?.powerUpCooldown ?? 0;
  const cooldownMax =
    currentPlayer?.powerUpCooldownMax ??
    currentPlayer?.character?.powerUp?.cooldown ??
    selectedCharacter?.powerUp?.cooldown ??
    15000;
  const activeDuration =
    currentPlayer?.character?.powerUp?.duration ??
    selectedCharacter?.powerUp?.duration ??
    3000;

  const triggerPowerUp = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' })), 100);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
                     window.innerWidth <= 1024 ||
                     window.innerHeight <= 1024 ||
                     ('ontouchstart' in window);
      setIsMobile(mobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleToggleMute = () => {
    audioManager.toggleMute();
    setMuted(audioManager.isMuted);
  };

  // Start/stop the game theme (independent of the global mute).
  const handleToggleMusic = () => {
    setMusicOn(audioManager.toggleMusic());
  };

  return (
    <>
      {!isMobile && (
        <div className="fixed top-24 left-0 right-0 z-[50] pointer-events-none flex justify-center">
          <h1 className="px-heading text-2xl md:text-3xl tracking-widest uppercase" style={{ color: '#ffc93c', textShadow: '4px 4px 0 #11111c' }}>
            CHASE
          </h1>
        </div>
      )}

      <motion.div
        className="fixed top-3 left-0 right-0 z-[55] px-3 sm:px-4 pointer-events-none"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="relative flex min-h-[44px] items-start justify-between">
          <div className="pointer-events-none flex max-w-[42%] flex-col gap-2 sm:max-w-none sm:flex-row sm:items-center">
            <div
              className="pointer-events-none flex items-center gap-1.5 px-chip px-2 py-1 sm:gap-2 sm:px-3 sm:py-2"
              style={hasEgg ? { background: '#ffc93c' } : undefined}
            >
              <Egg className="w-3 h-3 shrink-0 sm:w-4 sm:h-4" aria-hidden style={{ color: hasEgg ? '#2b2410' : '#f4e7c3' }} />
              <span className="px-heading text-[8px] uppercase sm:text-[9px]" style={{ color: hasEgg ? '#2b2410' : '#f4e7c3' }}>
                {hasEgg
                  ? 'You have it!'
                  : eggOnGround
                    ? 'Grab the egg'
                    : `Chase ${eggHolder?.character.name ?? 'them'}`}
              </span>
            </div>

            {/* 0G Compute status — the criterion #01 proof, on screen. Green = agent
                brains are running live on 0G; red = scripted fallback (0G offline). */}
            <div className="pointer-events-none flex items-center gap-1.5 px-chip px-2 py-1 sm:gap-2 sm:px-3 sm:py-2">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
                style={{
                  background: ogStatus.live ? '#4ade80' : '#f87171',
                  boxShadow: ogStatus.live ? '0 0 6px #4ade80' : 'none',
                }}
                aria-hidden
              />
              <span className="px-heading text-[8px] uppercase sm:text-[9px]" style={{ color: '#f4e7c3' }}>
                {ogStatus.live ? 'AI · 0G live' : 'AI · 0G offline'}
              </span>
            </div>
            {isMobile && (
              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleMusic}
                  className="px-chip p-1.5 transition-all hover:brightness-110"
                  aria-label={musicOn ? 'Stop music' : 'Start music'}
                >
                  <Music className={`h-4 w-4 ${musicOn ? 'text-[#5fcde4]' : 'text-[#e8503a] opacity-60'}`} />
                </button>
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="px-chip p-1.5 transition-all hover:brightness-110"
                  aria-label={muted ? 'Unmute' : 'Mute'}
                >
                  {muted ? (
                    <VolumeX className="h-4 w-4 text-[#e8503a]" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-[#5fcde4]" />
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2">
            <div className="flex flex-col items-center px-panel px-3 py-1 sm:px-5 sm:py-1.5">
              <span className="px-heading text-[7px] uppercase tracking-[0.2em] text-[#9fb0d8] sm:text-[8px]">
                Time left
              </span>
              <span className="px-heading text-base tabular-nums sm:text-xl" style={{ color: '#ffc93c', textShadow: '2px 2px 0 #11111c' }}>
                {formatMatchTime(timeRemaining)}
              </span>
            </div>
          </div>

          <div className="pointer-events-auto flex max-w-[42%] flex-col items-end gap-2 sm:max-w-none sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setPaused(true)}
              className="px-chip p-1.5 sm:p-3 transition-all hover:brightness-110"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4 sm:h-6 sm:w-6 text-[#f4e7c3]" />
            </button>
            {!isMobile && (
              <button
                type="button"
                onClick={handleToggleMusic}
                className="px-chip p-3 transition-all hover:brightness-110"
                aria-label={musicOn ? 'Stop music' : 'Start music'}
              >
                <Music className={`h-6 w-6 ${musicOn ? 'text-[#5fcde4]' : 'text-[#e8503a] opacity-60'}`} />
              </button>
            )}
            {!isMobile && (
              <button
                type="button"
                onClick={handleToggleMute}
                className="px-chip p-3 transition-all hover:brightness-110"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? (
                  <VolumeX className="h-6 w-6 text-[#e8503a]" />
                ) : (
                  <Volume2 className="h-6 w-6 text-[#5fcde4]" />
                )}
              </button>
            )}
            {!isMobile && (
              <div className="flex items-center gap-3 px-chip px-4 py-2">
                <p className="px-heading text-[9px] tracking-wider text-[#f4e7c3]">WASD/ARROWS</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* 0G Agents panel — the live "AI reasoning" surface. One tidy fixed panel
          (no world-space overlap) showing each agent's current 0G-chosen tactic +
          latest taunt. Greys to "scripted" when 0G is offline. */}
      {!isMobile && agents.length > 0 && (
        <div className="pointer-events-none fixed right-3 top-20 z-[55] w-[190px] px-panel px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: ogStatus.live ? '#4ade80' : '#f87171',
                boxShadow: ogStatus.live ? '0 0 6px #4ade80' : 'none',
              }}
              aria-hidden
            />
            <span className="px-heading text-[8px] uppercase tracking-[0.2em] text-[#9fb0d8]">0G Agents</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {agents.map((a) => {
              const mode = ogStatus.live ? a.aiIntent?.mode : undefined;
              const fresh = ogStatus.live && a.taunt && a.tauntAt && Date.now() - a.tauntAt < 4000;
              return (
                <div key={a.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-heading truncate text-[9px] text-[#f4e7c3]">{a.character.name}</span>
                    <span
                      className="px-heading shrink-0 text-[8px] uppercase"
                      style={{ color: ogStatus.live ? (mode ? MODE_COLOR[mode] ?? '#9fb0d8' : '#9fb0d8') : '#5b6b8c' }}
                    >
                      {ogStatus.live ? (mode ? MODE_LABEL[mode] ?? mode : '…') : 'scripted'}
                    </span>
                  </div>
                  {fresh && (
                    <span className="text-[8px] italic leading-tight text-[#c9b88a]">&ldquo;{a.taunt}&rdquo;</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isMobile && <Minimap />}

      {!isMobile && players.length > 0 && (
        <div className="pointer-events-auto fixed bottom-6 left-6 z-[56]">
          <PowerUpHudCluster
            powerUpReady={powerUpReady}
            powerUpActive={powerUpActive}
            powerUpCooldown={powerUpCooldown}
            cooldownMax={cooldownMax}
            activeDuration={activeDuration}
            onActivate={triggerPowerUp}
            size={88}
          />
        </div>
      )}
    </>
  );
}
