import * as Phaser from 'phaser';
import { useGameStore } from '@/store/gameStore';
import { GameScene } from './gameScene';

let isGameInitialized = false;
let activeGame: Phaser.Game | null = null;

export async function initializeGame(container: HTMLElement, serverStartTime?: number) {
  if (activeGame) {
    try { activeGame.destroy(true); } catch { /* already gone */ }
    activeGame = null;
  }
  if (isGameInitialized) {
    console.warn('⚠️ Game already initialized, skipping');
    return () => {};
  }

  isGameInitialized = true;
  console.log('🎮 Starting Phaser game initialization...');

  const store = useGameStore.getState();
  const { gameMode, selectedCharacter, selectedMap, setGamePhase, setPlayers, multiplayerHiddenFill, roomCode } = store;

  if (!gameMode || !selectedCharacter || !selectedMap) {
    isGameInitialized = false;
    return () => {};
  }

  if (!(gameMode === 'multiplayer' && multiplayerHiddenFill)) {
    setPlayers([]);
  }

  if (gameMode === 'single-player') {
    store.lockedCharacters.forEach((charId: string) => store.unlockCharacter(charId));
    store.setRoomPlayers([]);
  }

  const safeContainerW = Math.max(container.clientWidth, window.innerWidth || 0, 320);
  const safeContainerH = Math.max(container.clientHeight, window.innerHeight || 0, 240);
  const viewportWidth = safeContainerW;
  const viewportHeight = safeContainerH;
  const mapWidth = Math.max(selectedMap.width || 1400, viewportWidth, 1400);
  const mapHeight = Math.max(selectedMap.height || 900, viewportHeight, 900);

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: container,
    width: safeContainerW,
    height: safeContainerH,
    backgroundColor: '#5a7a96',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [GameScene],
    input: {
      keyboard: true,
      touch: true,
    },
    render: {
      antialias: false,
      pixelArt: true,
      roundPixels: true,
    },
  };

  const game = new Phaser.Game(config);
  activeGame = game;

  game.scene.start('GameScene', {
    mapId: selectedMap.id,
    mapWidth,
    mapHeight,
    gameMode,
    serverStartTime: serverStartTime || null,
    roomCode: roomCode || null,
  });

  return () => {
    console.log('🧹 Cleaning up Phaser game engine');
    isGameInitialized = false;
    try { game.destroy(true); } catch { /* already destroyed */ }
    if (activeGame === game) activeGame = null;

    useGameStore.getState().setMultiplayerHiddenFill(false);

    if (gameMode === 'single-player') {
      const currentStore = useGameStore.getState();
      currentStore.lockedCharacters.forEach((charId: string) => {
        currentStore.unlockCharacter(charId);
      });
    }
  };
}
