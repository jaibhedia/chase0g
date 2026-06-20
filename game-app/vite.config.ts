import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// In production the game is bundled into the Next shell's `public/game-app/` and
// served from the `/game-app/` sub-path (single-domain deploy), so assets must
// resolve under that prefix. In dev it runs standalone at the server root.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  base: mode === 'production' ? '/game-app/' : '/',
}));
