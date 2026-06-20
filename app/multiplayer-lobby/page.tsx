'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../providers/SocketProvider';
import { Button } from '@/components/ui/button';
import { gameMaps } from '../data/maps';
import { characters } from '../data/characters';
import { ArrowLeft, ArrowRight, Check, Globe, Lock, Play } from 'lucide-react';

export default function MultiplayerLobby() {
  const router = useRouter();
  const { selectedCharacter, selectedMap, gameMode, setMap, setServerStartTime, setRoomPlayers, setRoomCode: setStoreRoomCode, setMultiplayerHiddenFill, userId: storeUserId, initUserId } = useGameStore();
  const { socket, createRoom, joinRoom, setPlayerReady, startGame, leaveRoom } = useSocket();

  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [isInRoom, setIsInRoom] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [showMapSelection, setShowMapSelection] = useState(false);
  const [isPublic, setIsPublic] = useState(true); // Default to public rooms
  const [publicRooms, setPublicRooms] = useState<any[]>([]);
  const [showPublicRooms, setShowPublicRooms] = useState(false);
  const hiddenFillStartedRef = useRef(false);

  // After 15s, fill remaining slots with bots to reach 4 players total
  useEffect(() => {
    if (players.length >= 4 || players.length === 0) {
      hiddenFillStartedRef.current = false;
    }
  }, [players.length]);

  useEffect(() => {
    if (!isInRoom || !isHost || !selectedMap || !selectedCharacter) return;
    if (players.length >= 4) return;

    const botsNeeded = 4 - players.length;

    /* Disabled bot auto-fill based on user request:
    const tid = window.setTimeout(() => {
      if (hiddenFillStartedRef.current) return;
      hiddenFillStartedRef.current = true;
      const usedNames = new Set(players.map((p) => p.player_name));
      const filler = characters
        .filter((c) => !usedNames.has(c.name))
        .slice(0, botsNeeded)
        .map((c, i) => ({
          id: `lobby-bot-${i + 1}`,
          player_name: c.name,
          user_id: `bot_${(0xb000 + i).toString(16)}`,
          is_ready: true,
        }));
      setRoomPlayers([
        ...players.map((p) => ({ ...p, is_ready: true })),
        ...filler,
      ]);
      setMultiplayerHiddenFill(true);
      setServerStartTime(Date.now());
      router.push('/game');
    }, 15000);

    return () => window.clearTimeout(tid);
    */
    return () => {};
  }, [
    isInRoom,
    isHost,
    selectedMap,
    selectedCharacter,
    players,
    userId,
    setRoomPlayers,
    setMultiplayerHiddenFill,
    setServerStartTime,
    router,
  ]);

  // Load the guest user ID from the shared store (auto-generated on first visit).
  useEffect(() => {
    const id = storeUserId || initUserId();
    if (id) setUserId(id);
  }, [storeUserId, initUserId]);

  useEffect(() => {
    if (!socket) {
      console.log('⏳ Waiting for socket connection...');
      return;
    }

    console.log('🎮 Setting up lobby socket listeners');

    // Listen for public rooms list
    socket.on('public-rooms-list', (rooms: any[]) => {
      console.log('📋 Received public rooms:', rooms);
      setPublicRooms(rooms);
    });

    // Listen for room state response (periodic sync)
    socket.on('room-state-response', ({ room, players: syncedPlayers }) => {
      console.log('🔍 Room state response - DB has:', syncedPlayers?.length, 'players');
      console.log('   Frontend has:', players.length, 'players');
      if (syncedPlayers && syncedPlayers.length !== players.length) {
        console.log('⚠️ DESYNC DETECTED! Updating from:', players.length, 'to:', syncedPlayers.length);
        setPlayers(syncedPlayers);
      }
    });

    // Listen for room updates (comprehensive player sync)
    socket.on('room-update', ({ room, players: roomPlayers, readyPlayers }) => {
      console.log('🔄 Room update - Ready players:', readyPlayers);
      console.log('   Room players count:', roomPlayers?.length);
      console.log('   Room players:', roomPlayers?.map((p: any) => ({
        name: p.player_name,
        ready: p.is_ready,
        wallet: p.user_id?.slice(0, 8)
      })));
      if (roomPlayers) {
        // Force new array reference to trigger React re-render
        setPlayers([...roomPlayers]);
      }
    });

    // Listen for player updates
    socket.on('player-joined', ({ players: updatedPlayers, currentPlayers }) => {
      console.log('➕ Player joined - Total players:', updatedPlayers?.length);
      if (updatedPlayers) {
        // Force new array reference to trigger React re-render
        setPlayers([...updatedPlayers]);
      }
    });

    socket.on('player-left', ({ userId: leftAddress, players: updatedPlayers, currentPlayers }) => {
      console.log('➖ Player left:', leftAddress, '- Remaining:', updatedPlayers?.length);
      if (updatedPlayers) {
        // Force new array reference to trigger React re-render
        setPlayers([...updatedPlayers]);
      }
    });

    socket.on('player-ready-update', ({ players: updatedPlayers, readyCount, totalCount }) => {
      console.log('✅ Player ready update - Total:', updatedPlayers?.length);
      console.log('   Ready count:', readyCount, '/', totalCount);
      console.log('   Players received:', updatedPlayers?.map((p: any) => ({
        name: p.player_name,
        ready: p.is_ready,
        wallet: p.user_id?.slice(0, 8)
      })));
      if (updatedPlayers) {
        // Force new array reference to trigger React re-render
        setPlayers([...updatedPlayers]);
        console.log('   Updated local state with', updatedPlayers.length, 'players');
      }
    });

    socket.on('game-starting', ({ countdown }) => {
      console.log(`Game starting in ${countdown} seconds...`);
    });

    socket.on('game-started', ({ serverTime, players: gamePlayers, mapId }) => {
      console.log('🚀 Game started! Server time:', serverTime, 'Players:', gamePlayers?.length || 0);
      setServerStartTime(serverTime); // Save to store
      setRoomPlayers(gamePlayers || []); // Save players to store for game initialization
      // Guests never visit map-selection — guarantee a map so /game doesn't bounce to home.
      if (!useGameStore.getState().selectedMap) {
        setMap(gameMaps.find((m) => m.id === mapId) || gameMaps[0]);
      }
      router.push('/game');
    });

    return () => {
      console.log('🧹 Cleaning up lobby listeners (keeping socket alive)');
      socket.off('public-rooms-list');
      socket.off('room-state-response');
      socket.off('room-update');
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('player-ready-update');
      socket.off('game-starting');
      socket.off('game-started');
    };
  }, [socket, router, setServerStartTime, setRoomPlayers]);

  // Fetch public rooms when component mounts
  useEffect(() => {
    if (socket && !isInRoom) {
      console.log('🔍 Requesting public rooms list...');
      socket.emit('get-public-rooms');
      
      // Refresh public rooms every 3 seconds
      const interval = setInterval(() => {
        socket.emit('get-public-rooms');
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [socket, isInRoom]);

  // Periodic room state check while in room
  useEffect(() => {
    if (socket && isInRoom && roomCode) {
      const interval = setInterval(() => {
        console.log('🔄 Requesting room state refresh...');
        socket.emit('get-room-state', { roomCode });
      }, 2000); // Every 2 seconds

      return () => clearInterval(interval);
    }
  }, [socket, isInRoom, roomCode]);

  // Ensure the persistent socket is connected before a room action — revives a socket
  // left disconnected by a previous "Leave Room" instead of silently dropping into a
  // fake offline "LOCAL" room. Resolves false only if the server is truly unreachable.
  const ensureConnected = (): Promise<boolean> =>
    new Promise((resolve) => {
      const s = socket;
      if (!s) return resolve(false);
      if (s.connected) return resolve(true);
      let timer: ReturnType<typeof setTimeout>;
      const onConnect = () => { clearTimeout(timer); resolve(true); };
      timer = setTimeout(() => { s.off('connect', onConnect); resolve(false); }, 6000);
      s.once('connect', onConnect);
      s.connect();
    });

  const handleCreateRoom = async () => {
    if (!selectedCharacter) {
      setError('Please select character first');
      return;
    }

    setIsCreating(true);
    setError('');

    // Make sure the socket is actually connected before creating a room.
    if (!(await ensureConnected())) {
      setError("Can't reach the game server. Make sure it's running, then try again.");
      setIsCreating(false);
      return;
    }

    try {
      // Create room with public/private setting
      const response: any = await createRoom({
        userId,
        mapId: gameMaps[0].id,
        gameMode: 'multiplayer',
        characterId: parseInt(selectedCharacter.id.split('-')[1]),
        playerName: selectedCharacter.name,
        isPublic // Pass the public/private flag
      });

      setRoomCode(response.roomCode);
      setStoreRoomCode(response.roomCode); // persist for reconnect + voice in-game
      setIsInRoom(true);
      setIsHost(true); // Mark as host
      setShowMapSelection(true); // Show map selection to host

      // Initialize players array with the creator
      if (response.players) {
        console.log('🎮 Setting initial players:', response.players);
        setPlayers(response.players);
      }

      console.log('Room created:', response.roomCode);
    } catch (err: any) {
      setError(err?.message || 'Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    if (!selectedCharacter) {
      setError('Please select a character first');
      return;
    }

    setIsJoining(true);
    setError('');

    if (!(await ensureConnected())) {
      setError("Can't reach the game server. Make sure it's running, then try again.");
      setIsJoining(false);
      return;
    }

    try {
      const response: any = await joinRoom({
        roomCode: roomCode.toUpperCase(),
        userId,
        characterId: parseInt(selectedCharacter.id.split('-')[1]),
        playerName: selectedCharacter.name
      });

      setStoreRoomCode(roomCode.toUpperCase()); // persist for reconnect + voice in-game
      setIsInRoom(true);

      // Initialize players array from join response
      if (response.players) {
        console.log('🎮 Setting initial players after join:', response.players);
        setPlayers(response.players);
      }
      
      // Set the selected map from room data
      if (response.room?.map_id) {
        const map = gameMaps.find(m => m.id === response.room.map_id);
        if (map) {
          setMap(map);
        }
      }
      
      console.log('Joined room:', roomCode);
    } catch (err: any) {
      if (err?.message === 'Room not found') {
        setStoreRoomCode(null); // don't keep a dead code around for reconnect/voice
        setError('No room with that code — check it and try again.');
      } else {
        setError(err?.message || 'Failed to join room');
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinPublicRoom = async (publicRoomCode: string) => {
    if (!selectedCharacter) {
      setError('Please select a character first');
      return;
    }

    setRoomCode(publicRoomCode);
    setStoreRoomCode(publicRoomCode); // persist for reconnect + voice in-game
    setIsJoining(true);
    setError('');

    if (!(await ensureConnected())) {
      setError("Can't reach the game server. Make sure it's running, then try again.");
      setIsJoining(false);
      return;
    }

    try {
      const response: any = await joinRoom({
        roomCode: publicRoomCode,
        userId,
        characterId: parseInt(selectedCharacter.id.split('-')[1]),
        playerName: selectedCharacter.name
      });

      setIsInRoom(true);
      
      if (response.players) {
        console.log('🎮 Joined public room, players:', response.players);
        setPlayers(response.players);
      }
      
      if (response.room?.map_id) {
        const map = gameMaps.find(m => m.id === response.room.map_id);
        if (map) {
          setMap(map);
        }
      }
      
      console.log('Joined public room:', publicRoomCode);
    } catch (err: any) {
      if (err?.message === 'Room not found') {
        // Room was closed (host left / server restarted): clear the stale code and
        // drop it from the public list so it can't be re-clicked into the same error.
        setStoreRoomCode(null);
        setRoomCode('');
        setPublicRooms((prev) => prev.filter((r) => r.room_code !== publicRoomCode));
        setError('That room no longer exists — it was just closed.');
      } else {
        setError(err?.message || 'Failed to join public room');
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleToggleReady = () => {
    if (roomCode) setPlayerReady(true, roomCode, userId);
  };

  const minPlayers = 2;
  const maxPlayers = 4;
  const currentPlayers = players.length;
  const allReady = players.every(p => p.is_ready);
  const canStart = currentPlayers >= minPlayers && allReady;
  // Ready-state is derived from the SERVER's player list (single source of truth) so
  // the "you are ready" banner can never disagree with the roster below it.
  const me = players.find((p) => p.user_id === userId);
  const isReady = !!me?.is_ready;

  // Map Selection View (only for host, shows after room created)
  if (showMapSelection && isHost && !selectedMap) {
    return (
      <div className="h-screen h-[100dvh] w-full px-solid-bg flex flex-col overflow-y-auto p-4">
        <div className="w-full max-w-6xl mx-auto my-auto">
          <h1 className="text-2xl md:text-4xl font-bold text-white text-center mb-4">
            Choose Game Map
          </h1>
          <p className="text-gray-300 text-center mb-8">
            As the host, select the map for this game
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {gameMaps.map((map, index) => (
              <div 
                key={map.id}
                className="p-6 pixel-panel cursor-pointer transition-all hover:scale-105"
                onClick={() => {
                  setMap(map);
                  setShowMapSelection(false);
                  setPlayerReady(true, roomCode, userId); // Auto-ready (server-side) after selecting map
                }}
              >
                <h3 className="pixel-font text-2xl font-bold text-[#f4e7c3] mb-2">{map.name}</h3>
                <p className="text-[#f4e7c3]/70 mb-4">{map.description}</p>
                <div className="bg-[#4d2813] pixel-border p-4 mb-4">
                  <p className="text-sm text-[#ffc93c]">Dimensions: {map.width} x {map.height}</p>
                </div>
                <Button className="w-full">
                  Select This Map
                </Button>
              </div>
            ))}
          </div>

          <div className="text-center text-gray-400">
            <p>Room Code: <span className="text-white font-bold text-2xl">{roomCode}</span></p>
            <p className="mt-2">Share this code with your friends to join!</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isInRoom) {
    return (
      <div className="h-screen h-[100dvh] w-full px-solid-bg flex flex-col overflow-y-auto p-4">
        <div className="w-full max-w-6xl mx-auto my-auto">
          <h1 className="text-2xl md:text-4xl font-bold text-white text-center mb-8">
            Multiplayer Lobby
          </h1>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Create Room */}
            <div className="p-6 pixel-panel">
              <h2 className="pixel-font text-2xl font-bold text-[#f4e7c3] mb-4">Create Room</h2>
              <p className="text-[#f4e7c3]/70 mb-4">
                Host a new game
              </p>
              
              {/* Public / Private toggle */}
              <div className="mb-6">
                <p className="text-[#f4e7c3]/70 text-[10px] uppercase tracking-wider mb-2">Room Visibility</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    aria-pressed={isPublic}
                    className={`flex flex-col items-center gap-1 p-3 pixel-border transition-all ${isPublic ? 'bg-[#6ab04c] text-[#0e2a08]' : 'bg-[#4d2813] text-[#f4e7c3]/60 hover:brightness-110'}`}
                  >
                    <Globe className="w-5 h-5" />
                    <span className="font-bold text-sm uppercase">Public</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    aria-pressed={!isPublic}
                    className={`flex flex-col items-center gap-1 p-3 pixel-border transition-all ${!isPublic ? 'bg-[#ffc93c] text-[#2b2410]' : 'bg-[#4d2813] text-[#f4e7c3]/60 hover:brightness-110'}`}
                  >
                    <Lock className="w-5 h-5" />
                    <span className="font-bold text-sm uppercase">Private</span>
                  </button>
                </div>
                <p className="text-gray-400 text-xs mt-2">
                  {isPublic ? 'Anyone can find and join it from the public list.' : 'Only people with the room code can join.'}
                </p>
              </div>
              
              <Button
                onClick={handleCreateRoom}
                disabled={isCreating}
                className="w-full py-6 text-lg"
              >
                {isCreating ? 'Creating...' : 'Create Room'}
              </Button>
            </div>

            {/* Join Room */}
            <div className="p-6 pixel-panel">
              <h2 className="pixel-font text-2xl font-bold text-[#f4e7c3] mb-4">Join with Code</h2>
              <p className="text-[#f4e7c3]/70 mb-4">
                Enter a room code to join a private game
              </p>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                maxLength={6}
                className="w-full px-4 py-3 bg-[#4d2813] border-4 border-[#261309] text-[#f4e7c3] text-center text-xl font-bold mb-4 uppercase focus:outline-none focus:border-[#ffc93c]"
              />
              <Button
                onClick={handleJoinRoom}
                disabled={isJoining || !roomCode.trim()}
                className="w-full py-6 text-lg"
              >
                {isJoining ? 'Joining...' : 'Join Room'}
              </Button>
            </div>

            {/* Public Rooms */}
            <div className="p-6 pixel-panel">
              <h2 className="pixel-font text-2xl font-bold text-[#f4e7c3] mb-4">Public Rooms</h2>
              <p className="text-[#f4e7c3]/70 mb-4">
                Join any public game
              </p>
              <div className="text-center">
                <div className="text-4xl font-bold text-[#6ab04c] mb-2">
                  {publicRooms.length}
                </div>
                <p className="text-[#f4e7c3]/70 text-sm mb-4">
                  {publicRooms.length === 1 ? 'room available' : 'rooms available'}
                </p>
                <Button
                  onClick={() => setShowPublicRooms(!showPublicRooms)}
                  className="w-full py-6 text-lg"
                >
                  {showPublicRooms ? 'Hide Rooms' : 'Show Rooms'}
                </Button>
              </div>
            </div>
          </div>

          {/* Public Rooms List */}
          {showPublicRooms && publicRooms.length > 0 && (
            <div className="p-6 pixel-panel mb-6">
              <h3 className="text-xl font-bold text-white mb-4">Available Public Rooms</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {publicRooms.map((room) => (
                  <div
                    key={room.room_code}
                    className="p-4 pixel-panel hover:scale-105 transition-all cursor-pointer"
                    onClick={() => handleJoinPublicRoom(room.room_code)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-[#f4e7c3]">{room.room_code}</span>
                      <span className={`px-3 py-1 pixel-border text-sm font-semibold ${
                        room.current_players >= 4 ? 'bg-[#e8503a] text-white' :
                        room.current_players >= 2 ? 'bg-[#ffc93c] text-[#261309]' :
                        'bg-[#6ab04c] text-white'
                      }`}>
                        {room.current_players}/4 Players
                      </span>
                    </div>
                    {room.map_id && (
                      <p className="text-[#f4e7c3]/70 text-sm">
                        Map: {gameMaps.find(m => m.id === room.map_id)?.name || 'Unknown'}
                      </p>
                    )}
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoinPublicRoom(room.room_code);
                      }}
                      disabled={isJoining || room.current_players >= 4}
                      className="w-full mt-3 py-2"
                    >
                      {room.current_players >= 4 ? 'Full' : (
                        <span className="inline-flex items-center justify-center gap-1">Join <ArrowRight className="w-4 h-4" /></span>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showPublicRooms && publicRooms.length === 0 && (
            <div className="p-6 pixel-panel mb-6">
              <p className="text-[#f4e7c3]/70 text-center">
                No public rooms available. Create one to get started!
              </p>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-500/20 border-2 border-red-500 rounded-lg">
              <p className="text-red-300 text-center font-semibold">{error}</p>
            </div>
          )}

          <div className="mt-8 text-center">
            <Button
              onClick={() => router.push('/character-selection')}
              className="px-8 py-3"
            >
              <span className="inline-flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" /> Back to Character Selection</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-solid-bg flex items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto my-auto">
        <h1 className="text-2xl md:text-4xl font-bold text-white text-center mb-8 title-pixel">
          Waiting Room
        </h1>

        {/* Room Code Display */}
        <div className="p-6 pixel-panel mb-6">
          <div className="text-center">
            <p className="text-[#f4e7c3]/70 mb-2">Room Code</p>
            <p className="text-5xl font-bold text-[#f4e7c3] tracking-widest">
              {roomCode}
            </p>
            <p className="text-[#ffc93c] mt-2 text-sm">
              Share this code with your friends
            </p>
          </div>
        </div>

        {/* Selected Map Display */}
        {selectedMap && (
          <div className="p-4 pixel-panel mb-6">
            <div className="text-center">
              <p className="text-[#ffc93c] text-sm mb-1">Playing On</p>
              <p className="text-3xl font-bold text-[#f4e7c3]">{selectedMap.name}</p>
              <p className="text-[#f4e7c3]/70 text-sm mt-1">{selectedMap.description}</p>
            </div>
          </div>
        )}

        {/* Player Count */}
        <div className="p-4 pixel-panel mb-6">
          <div className="flex items-center justify-between">
            <span className="text-xl text-[#f4e7c3]">
              Players: {currentPlayers} / {maxPlayers}
            </span>
            <span className={`text-lg ${currentPlayers >= minPlayers ? 'text-[#6ab04c]' : 'text-[#ffc93c]'}`}>
              {currentPlayers >= minPlayers ? (
                <span className="inline-flex items-center gap-1"><Check className="w-4 h-4" /> Minimum met</span>
              ) : `Need ${minPlayers - currentPlayers} more`}
            </span>
          </div>
        </div>

        {/* Players List */}
        <div className="p-6 pixel-panel mb-6">
          <h3 className="pixel-font text-xl font-bold text-[#f4e7c3] mb-4">Players</h3>
          <div className="space-y-3">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-3 bg-[#4d2813] pixel-border"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 border-2 border-[#261309] ${player.is_ready ? 'bg-[#6ab04c]' : 'bg-[#ffc93c]'}`} />
                  <span className="text-[#f4e7c3] font-semibold">
                    {player.player_name}
                  </span>
                  {player.user_id === userId && (
                    <span className="text-[#ffc93c] text-sm">(You)</span>
                  )}
                </div>
                <span className={`text-sm ${player.is_ready ? 'text-[#6ab04c]' : 'text-[#ffc93c]'}`}>
                  {player.is_ready ? 'Ready' : 'Not Ready'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Ready Button */}
        {!isReady && (
          <Button
            onClick={handleToggleReady}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-6 text-xl mb-4"
          >
            Ready Up!
          </Button>
        )}

        {isReady && !canStart && (
          <div className="p-4 bg-green-500/20 border-2 border-green-500 rounded-lg mb-4">
            <p className="text-green-300 text-center font-semibold inline-flex items-center justify-center gap-2 w-full">
              <Check className="w-4 h-4 shrink-0" /> You are ready! Waiting for other players...
            </p>
          </div>
        )}

        {isHost && canStart && (
          <Button
            onClick={() => startGame()}
            className="w-full py-6 text-xl mb-4 animate-pulse"
          >
            <span className="inline-flex items-center justify-center gap-2"><Play className="w-5 h-5" /> START GAME</span>
          </Button>
        )}

        {!isHost && canStart && (
          <div className="p-4 bg-[#6ab04c]/20 pixel-border border-[#6ab04c] mb-4">
            <p className="text-[#6ab04c] text-center font-semibold text-lg inline-flex items-center justify-center gap-2 w-full">
              <Check className="w-4 h-4 shrink-0" /> Ready to start! Waiting for host...
            </p>
          </div>
        )}

        <div className="text-center">
          <Button
            onClick={() => {
              leaveRoom();
              setIsInRoom(false);
              router.push('/mode-selection');
            }}
            className="px-8 py-3"
          >
            Leave Room
          </Button>
        </div>
      </div>
    </div>
  );
}
