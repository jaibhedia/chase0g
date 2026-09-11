'use client';

import { useRouter } from 'next/navigation';
import { useGameStore, Player } from '../store/gameStore';
import { useEffect, useMemo, useState } from 'react';
import { audioManager } from '@/app/utils/audioManager';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Home, RotateCcw, Trophy, Crown, Skull, Medal, Target, Star, ThumbsUp, Gamepad2 } from 'lucide-react';
import { CHASE_STAKE_ADDRESS } from '@/lib/arc/chaseStake';
import { arcAddressUrl } from '@/lib/arc/chain';

/**
 * What the server reports when a match ends: the settled Arc pot.
 *
 * Named `ReplayInfo` and delivered over `replay-stored` for historical reasons — it
 * carried 0G Storage replay hashes and a 0G leaderboard row before both were removed.
 */
interface ReplayInfo {
  arcTxHash: string | null;
  arcPot: string | null;
  arcExplorer: string | null;
}

export default function Results() {
  const router = useRouter();
  const { winner, gameMessage, resetGame, players, setGameResult, setPlayers } = useGameStore();
  const [replay, setReplay] = useState<ReplayInfo | null>(null);

  const playerWon = winner?.id === 'player';

  // Rank players by cumulative egg-carry time (higher = better). Current holder
  // gets a small artificial boost so the player who ends the round holding the
  // egg is always #1, matching the in-scene winner.
  const rankedPlayers = useMemo(() => {
    return [...players]
      .sort((a, b) => {
        const aScore = (a.eggHoldCount ?? 0) + (a.id === winner?.id ? 1_000_000 : 0);
        const bScore = (b.eggHoldCount ?? 0) + (b.id === winner?.id ? 1_000_000 : 0);
        return bScore - aScore;
      })
      .map((player, index) => ({
        ...player,
        rank: index + 1
      }));
  }, [players]);

  // Get medal color based on rank
  const getMedalColor = (rank: number) => {
    switch(rank) {
      case 1: return 'text-yellow-400'; // Gold
      case 2: return 'text-gray-300'; // Silver
      case 3: return 'text-orange-600'; // Bronze
      default: return 'text-gray-500';
    }
  };

  // Get rank border/color
  const getRankGradient = (rank: number) => {
    switch(rank) {
      case 1: return 'bg-[#804d2e] border-[#ffc93c]';
      case 2: return 'bg-[#4d2813] border-[#f4e7c3]';
      case 3: return 'bg-[#4d2813] border-[#c97b3c]';
      default: return 'bg-[#261309] border-[#4d2813]';
    }
  };

  useEffect(() => {
    if (!winner) {
      try {
        // The game (different origin in dev) hands the result back via the URL
        // hash; fall back to localStorage for the same-origin production build.
        const readResult = (): any | null => {
          const m = window.location.hash.match(/[#&]result=([^&]+)/);
          if (m) {
            try {
              const parsed = JSON.parse(decodeURIComponent(m[1]));
              try { localStorage.setItem('chase-game-result', JSON.stringify(parsed)); } catch { /* ignore */ }
              history.replaceState(null, '', window.location.pathname + window.location.search);
              return parsed;
            } catch { /* fall through */ }
          }
          const raw = localStorage.getItem('chase-game-result');
          return raw ? JSON.parse(raw) : null;
        };
        const res = readResult();
        if (res?.winner) {
          setGameResult(res.winner, res.gameMessage ?? '');
          setPlayers(res.players ?? []);
          if (res.replay) setReplay(res.replay);
        } else {
          router.push('/');
        }
      } catch {
        router.push('/');
      }
    } else {
      audioManager.play(playerWon ? 'victory' : 'defeat');
    }
  }, [winner, router, playerWon, setGameResult, setPlayers]);

  // Same-origin (production) fallback: the game mirrors the settlement result to
  // localStorage; the hash handoff above is the cross-origin (dev) channel.
  useEffect(() => {
    if (replay) return;
    try {
      const raw = localStorage.getItem('chase-replay');
      if (raw) setReplay(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [replay]);

  const handlePlayAgain = () => {
    resetGame();
    router.push('/mode-selection');
  };

  const handleHome = () => {
    resetGame();
    router.push('/');
  };

  if (!winner) return null;

  return (
    <main className="h-screen h-[100dvh] w-full flex flex-col overflow-y-auto px-solid-bg p-4 relative">
      {/* Animated Confetti/Particles */}
      {playerWon && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: -100, x: Math.random() * window.innerWidth, rotate: 0 }}
              animate={{
                y: window.innerHeight + 100,
                rotate: 360,
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: Math.random() * 3 + 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
              className="absolute w-3 h-3 rounded-full"
              style={{
                backgroundColor: ['#fbbf24', '#f59e0b', '#ef4444', '#ec4899', '#a855f7'][Math.floor(Math.random() * 5)],
              }}
            />
          ))}
        </div>
      )}

      <div className="w-full max-w-4xl mx-auto my-auto text-center space-y-8 p-4 relative z-10">
        {/* Victory/Defeat Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 10 }}
          className="relative"
        >
          {playerWon ? (
            <motion.div
              animate={{ 
                rotate: [0, -10, 10, -10, 10, 0],
                scale: [1, 1.1, 1, 1.1, 1]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Trophy className="w-40 h-40 mx-auto text-yellow-400 drop-shadow-2xl" style={{
                filter: 'drop-shadow(0 0 30px rgba(250, 204, 21, 0.8))',
              }} />
            </motion.div>
          ) : (
            <motion.div
              animate={{ 
                y: [0, -10, 0],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Skull className="w-40 h-40 mx-auto text-red-500 drop-shadow-2xl" style={{
                filter: 'drop-shadow(0 0 30px rgba(239, 68, 68, 0.6))',
              }} />
            </motion.div>
          )}
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-3xl md:text-6xl mb-4 uppercase tracking-wider title-pixel"
            style={{ color: playerWon ? '#ffc93c' : '#e8503a' }}>
            {playerWon ? 'VICTORY!' : 'DEFEATED!'}
          </h1>
        </motion.div>

        {/* Winner Announcement */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          className="relative pixel-panel p-8 overflow-hidden"
          style={{ borderColor: playerWon ? '#ffc93c' : '#e8503a' }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
          
          <div className="flex items-center justify-center gap-4 mb-4">
            <Crown className="w-8 h-8 text-yellow-400" />
            <h2 className="text-4xl font-black text-white uppercase tracking-wider">
              Champion: {winner?.character.name}
            </h2>
            <Crown className="w-8 h-8 text-yellow-400" />
          </div>
          
          <motion.p
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-2xl font-bold text-white"
          >
            {gameMessage}
          </motion.p>
        </motion.div>

        {/* Match Stats */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="pixel-panel p-6"
        >
          <h3 className="text-base md:text-2xl text-[#ffc93c] mb-6 uppercase tracking-wider flex items-center justify-center gap-3 pixel-shadow">
            <Trophy className="w-7 h-7" /> Player Rankings <Trophy className="w-7 h-7" />
          </h3>
          
          {/* Leaderboard */}
          <div className="space-y-4">
            {rankedPlayers.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8 + index * 0.1 }}
                whileHover={{ scale: 1.02, x: 10 }}
                className={`relative ${getRankGradient(player.rank)} pixel-border p-4 ${
                  player.id === 'player' ? 'border-[#6ab04c] bg-[#804d2e]' : ''
                }`}
              >
                {/* Rank Badge */}
                <div className="absolute -left-3 -top-3 w-12 h-12">
                  <div className={`w-full h-full ${
                    player.rank === 1 ? 'bg-[#ffc93c] text-[#261309]' :
                    player.rank === 2 ? 'bg-[#f4e7c3] text-[#261309]' :
                    player.rank === 3 ? 'bg-[#c97b3c] text-[#261309]' :
                    'bg-[#4d2813] text-[#f4e7c3]'
                  } flex items-center justify-center pixel-border shadow-lg`}>
                    <span className="pixel-font font-black text-xl">#{player.rank}</span>
                  </div>
                </div>

                {/* Player Info */}
                <div className="flex items-center justify-between pl-14">
                  <div className="flex items-center gap-4">
                    {/* Medal Icon */}
                    {player.rank <= 3 && (
                      <Medal className={`w-8 h-8 ${getMedalColor(player.rank)}`} style={{
                        filter: player.rank === 1 ? 'drop-shadow(0 0 10px rgba(250, 204, 21, 0.8))' : 'none'
                      }} />
                    )}
                    
                    {/* Character Image or Color */}
                    <div 
                      className="w-14 h-14 flex items-center justify-center pixel-border"
                      style={{ backgroundColor: player.character.color }}
                    >
                      {player.character.image ? (
                        <img 
                          src={player.character.image} 
                          alt={player.character.name}
                          className="w-12 h-12 object-contain"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      ) : (
                        <div className="w-full h-full" style={{ backgroundColor: player.character.color }} />
                      )}
                    </div>

                    {/* Player Name */}
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xl font-black text-white">
                          {player.character.name}
                        </h4>
                        {player.id === 'player' && (
                          <span className="px-2 py-1 bg-[#6ab04c] text-white text-[10px] font-bold uppercase pixel-border">
                            You
                          </span>
                        )}
                        {player.isBot && (
                          <span className="px-2 py-1 bg-[#4d2813] text-[#f4e7c3] text-[10px] font-bold uppercase pixel-border">
                            Bot
                          </span>
                        )}
                        {player.rank === 1 && (
                          <Crown className="w-5 h-5 text-yellow-400" />
                        )}
                      </div>
                      <p className="text-sm text-gray-300">
                        Speed: {player.character.speed.toFixed(1)}
                      </p>
                    </div>
                  </div>

                  {/* Performance Stats */}
                  <div className="flex items-center gap-6">
                    {/* Egg-carry time */}
                    <div className="text-center">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="w-5 h-5 text-yellow-300" />
                        <p className="text-sm font-bold text-gray-300 uppercase">Grabs</p>
                      </div>
                      <p className={`text-3xl font-black ${
                        player.id === winner?.id ? 'text-yellow-300' :
                        (player.eggHoldCount ?? 0) > 0 ? 'text-amber-300' :
                        'text-gray-500'
                      }`}>
                        {player.eggHoldCount ?? 0}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="text-right min-w-[100px]">
                      <p className={`text-lg font-black uppercase ${
                        player.id === winner?.id ? 'text-[#ffc93c]' :
                        (player.eggHoldCount ?? 0) > 3 ? 'text-[#f4e7c3]' :
                        'text-[#f4e7c3]/50'
                      }`}>
                        {player.id === winner?.id ? (
                          <span className="inline-flex items-center justify-end gap-1.5"><Trophy className="w-4 h-4" /> Winner</span>
                        ) : (player.eggHoldCount ?? 0) >= 3 ? (
                          <span className="inline-flex items-center justify-end gap-1.5"><Star className="w-4 h-4" /> Thief</span>
                        ) : (player.eggHoldCount ?? 0) > 0 ? (
                          <span className="inline-flex items-center justify-end gap-1.5"><ThumbsUp className="w-4 h-4" /> Stole it</span>
                        ) : (
                          <span className="inline-flex items-center justify-end gap-1.5 opacity-70"><Skull className="w-4 h-4" /> Never held</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Winner Glow Effect */}
                {player.rank === 1 && (
                  <motion.div
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(250, 204, 21, 0.5)',
                        '0 0 40px rgba(250, 204, 21, 0.8)',
                        '0 0 20px rgba(250, 204, 21, 0.5)',
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 pointer-events-none"
                  />
                )}
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-6 pt-6 border-t-4 border-[#261309]"
          >
            <p className="text-[#f4e7c3] text-sm text-center inline-flex items-center justify-center gap-2 w-full">
              <Gamepad2 className="w-4 h-4 shrink-0" />
              <span>The player holding the egg when the <span className="text-[#ffc93c] font-bold">timer hits zero</span> wins the game!</span>
            </p>
          </motion.div>
        </motion.div>

        {/* The payout. This is the whole product in one panel: real USDC moved between
            two strangers because of what happened in a game, with a link to the
            transaction that proves it. It sits above the replay artifact deliberately —
            a player (or a judge) should meet the money before anything else. */}
        {replay?.arcTxHash && replay.arcPot && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-6 p-6 pixel-panel text-center"
          >
            <p className="text-[#ffc93c] text-sm mb-2">
              {playerWon ? 'You won the pot' : 'Pot paid out'}
            </p>
            <p className="text-4xl md:text-5xl font-bold text-[#f4e7c3] mb-1">
              {replay.arcPot} USDC
            </p>
            <p className="text-[#f4e7c3]/60 text-sm mb-4">
              {playerWon
                ? 'Settled on Arc and sent to your wallet.'
                : `Settled on Arc and sent to ${winner?.character?.name ?? 'the winner'}.`}
            </p>
            {replay.arcExplorer && (
              <a
                href={replay.arcExplorer}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-5 py-2 bg-[#ffc93c] text-[#1a1a1a] pixel-font font-bold text-sm hover:brightness-110 transition"
              >
                View the transaction
              </a>
            )}

            {/* Full receipt. The amount alone is a number on a screen; these three lines
                are what make it checkable by someone who doesn't trust us — which
                contract held the pot, which chain, and the transaction that released it. */}
            <div className="mt-4 border-t border-[#f4e7c3]/15 pt-3 text-left text-[10px] leading-relaxed text-[#f4e7c3]/55">
              <div className="flex justify-between gap-2">
                <span>Escrow</span>
                <a
                  className="truncate text-[#5FCDE4] underline"
                  href={arcAddressUrl(CHASE_STAKE_ADDRESS)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={CHASE_STAKE_ADDRESS}
                >
                  {CHASE_STAKE_ADDRESS.slice(0, 6)}…{CHASE_STAKE_ADDRESS.slice(-4)} ↗
                </a>
              </div>
              <div className="flex justify-between gap-2">
                <span>Network</span>
                <span>Arc testnet · 5042002</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Payout tx</span>
                <span className="truncate" title={replay.arcTxHash}>
                  {replay.arcTxHash.slice(0, 6)}…{replay.arcTxHash.slice(-4)}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button
            onClick={handlePlayAgain}
            variant="default"
            size="xl"
            className="gap-3"
          >
            <RotateCcw className="w-6 h-6" />
            Play Again
          </Button>
          <Button
            onClick={handleHome}
            variant="outline"
            size="xl"
            className="gap-3"
          >
            <Home className="w-6 h-6" />
            Home
          </Button>
        </motion.div>
      </div>
    </main>
  );
}
