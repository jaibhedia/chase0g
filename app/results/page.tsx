'use client';

import { useRouter } from 'next/navigation';
import { useGameStore, Player } from '../store/gameStore';
import { useEffect, useMemo, useState } from 'react';
import { audioManager } from '@/app/utils/audioManager';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Home, RotateCcw, Trophy, Crown, Skull, Medal, Target, Star, ThumbsUp, Gamepad2, ShieldCheck, ExternalLink, Cpu } from 'lucide-react';

/** 0G Storage replay artifact passed from the game (hash handoff or localStorage). */
interface ReplayInfo {
  rootHash: string | null;
  txHash: string | null;
  transcriptLen: number;
  ogStorageEnabled: boolean;
}
// Galileo testnet explorers — the verifiable proof links for the demo.
const OG_TX_EXPLORER = 'https://chainscan-galileo.0g.ai/tx/';
const OG_STORAGE_SCAN = 'https://storagescan-galileo.0g.ai/';

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

  // Same-origin (production) fallback: the game mirrors the 0G Storage artifact to
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

        {/* Verifiable replay on 0G Storage — the criterion #01 artifact made tangible:
            the match (result + the REAL AI decision transcript) is addressable by an
            on-chain Merkle root, proving the agents actually reasoned on 0G. */}
        {replay?.rootHash && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.85 }}
            className="pixel-panel p-5 text-left"
            style={{ borderColor: '#5fcde4' }}
          >
            <h3 className="text-sm md:text-lg text-[#5fcde4] mb-3 uppercase tracking-wider flex items-center justify-center gap-2 pixel-shadow">
              <ShieldCheck className="w-5 h-5" /> Verifiable on 0G Storage
            </h3>
            <p className="text-[#f4e7c3]/80 text-xs text-center mb-4 inline-flex items-center justify-center gap-1.5 w-full">
              <Cpu className="w-3.5 h-3.5 shrink-0" />
              {replay.transcriptLen} live AI decisions from 0G Compute, stored as a tamper-proof replay.
            </p>
            <div className="space-y-2">
              <div className="bg-[#261309] pixel-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-[#9fb0d8] mb-1">Storage root hash</p>
                <p className="text-[#f4e7c3] text-xs font-mono break-all" title={replay.rootHash}>{replay.rootHash}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={OG_STORAGE_SCAN}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#4d2813] hover:brightness-110 pixel-border px-3 py-2 text-[#f4e7c3] text-xs uppercase tracking-wider transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> 0G Storage Scan
                </a>
                {replay.txHash && (
                  <a
                    href={`${OG_TX_EXPLORER}${replay.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#4d2813] hover:brightness-110 pixel-border px-3 py-2 text-[#f4e7c3] text-xs uppercase tracking-wider transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Storage Tx
                  </a>
                )}
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
