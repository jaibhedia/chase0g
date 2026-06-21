import { Howl, Howler } from 'howler';

class AudioManager {
  private static instance: AudioManager;
  private sounds: Map<string, Howl> = new Map();
  private musicVolume: number = 0.3;
  private sfxVolume: number = 0.5;
  public isMuted: boolean = false;
  /** Theme on/off toggle (HUD music button) — independent of the global mute. */
  private musicEnabled: boolean = true;
  private initialized: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      Howler.autoUnlock = true;
    }
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  init() {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    // Real audio files (under the Vite base so they resolve in the embedded build too).
    const base = import.meta.env.BASE_URL;
    this.sounds.set('bgm-game', new Howl({
      src: [`${base}assets/audio/theme.mp3`],
      format: ['mp3'],
      loop: true,
      html5: true, // stream the theme instead of fully decoding it
      volume: this.musicVolume,
    }));
    this.sounds.set('power-use', new Howl({
      src: [`${base}assets/audio/powerup.mp3`],
      format: ['mp3'],
      volume: this.sfxVolume * 0.7,
    }));
    this.sounds.set('running', new Howl({
      src: [`${base}assets/audio/running.mp3`],
      format: ['mp3'],
      loop: true,
      volume: this.sfxVolume * 0.45,
    }));

    this.sounds.set('bgm-menu', new Howl({
      src: [this.generateTone(440, 2, 'sine')],
      format: ['wav'],
      loop: true,
      volume: this.musicVolume * 0.5,
    }));

    this.sounds.set('click', new Howl({
      src: [this.generateTone(800, 0.1, 'square')],
      format: ['wav'],
      volume: this.sfxVolume * 0.3,
    }));

    this.sounds.set('hover', new Howl({
      src: [this.generateTone(600, 0.05, 'sine')],
      format: ['wav'],
      volume: this.sfxVolume * 0.2,
    }));

    this.sounds.set('select', new Howl({
      src: [this.generateTone(1000, 0.2, 'triangle')],
      format: ['wav'],
      volume: this.sfxVolume * 0.4,
    }));

    this.sounds.set('countdown', new Howl({
      src: [this.generateTone(500, 0.3, 'sawtooth')],
      format: ['wav'],
      volume: this.sfxVolume * 0.6,
    }));

    this.sounds.set('victory', new Howl({
      src: [this.generateChord([523, 659, 784], 1)],
      format: ['wav'],
      volume: this.sfxVolume * 0.7,
    }));

    this.sounds.set('defeat', new Howl({
      src: [this.generateChord([200, 150, 100], 1)],
      format: ['wav'],
      volume: this.sfxVolume * 0.7,
    }));

    this.sounds.set('hide', new Howl({
      src: [this.generateTone(300, 0.3, 'sine')],
      format: ['wav'],
      volume: this.sfxVolume * 0.5,
    }));

    this.sounds.set('caught', new Howl({
      src: [this.generateTone(200, 0.5, 'sawtooth')],
      format: ['wav'],
      volume: this.sfxVolume * 0.8,
    }));

    this.sounds.set('footstep', new Howl({
      src: [this.generateNoise(0.05)],
      format: ['wav'],
      volume: this.sfxVolume * 0.2,
    }));

    this.sounds.set('heartbeat', new Howl({
      src: [this.generateTone(80, 0.3, 'sine')],
      format: ['wav'],
      volume: this.sfxVolume * 0.6,
      loop: true,
    }));
  }

  private generateTone(frequency: number, duration: number, type: OscillatorType = 'sine'): string {
    if (typeof window === 'undefined') return '';

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sampleRate = audioContext.sampleRate;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let value = 0;

      switch (type) {
        case 'sine':
          value = Math.sin(2 * Math.PI * frequency * t);
          break;
        case 'square':
          value = Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1;
          break;
        case 'triangle':
          value = 2 * Math.abs(2 * (t * frequency - Math.floor(t * frequency + 0.5))) - 1;
          break;
        case 'sawtooth':
          value = 2 * (t * frequency - Math.floor(t * frequency + 0.5));
          break;
      }

      const envelope = Math.min(i / (sampleRate * 0.01), 1) *
                       Math.min((numSamples - i) / (sampleRate * 0.05), 1);
      data[i] = value * envelope * 0.3;
    }

    return this.bufferToWave(buffer, numSamples);
  }

  private generateChord(frequencies: number[], duration: number): string {
    if (typeof window === 'undefined') return '';

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sampleRate = audioContext.sampleRate;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let value = 0;

      frequencies.forEach(freq => {
        value += Math.sin(2 * Math.PI * freq * t) / frequencies.length;
      });

      const envelope = Math.min(i / (sampleRate * 0.01), 1) *
                       Math.min((numSamples - i) / (sampleRate * 0.1), 1);
      data[i] = value * envelope * 0.3;
    }

    return this.bufferToWave(buffer, numSamples);
  }

  private generateNoise(duration: number): string {
    if (typeof window === 'undefined') return '';

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sampleRate = audioContext.sampleRate;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.1;
    }

    return this.bufferToWave(buffer, numSamples);
  }

  private bufferToWave(buffer: AudioBuffer, length: number): string {
    const numberOfChannels = 1;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;

    const data = new Int16Array(length);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    const buffer2 = new ArrayBuffer(44 + data.length * 2);
    const view = new DataView(buffer2);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + data.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, data.length * 2, true);

    for (let i = 0; i < data.length; i++) {
      view.setInt16(44 + i * 2, data[i], true);
    }

    const blob = new Blob([buffer2], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  play(soundName: string) {
    if (this.isMuted) return;
    const sound = this.sounds.get(soundName);
    if (sound) {
      sound.play();
    }
  }

  stop(soundName: string) {
    const sound = this.sounds.get(soundName);
    if (sound) {
      sound.stop();
    }
  }

  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach((sound, name) => {
      if (name.startsWith('bgm-')) {
        sound.volume(this.musicVolume * 0.5);
      }
    });
  }

  setSFXVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    Howler.mute(this.isMuted);
    return this.isMuted;
  }

  getMuted() {
    return this.isMuted;
  }

  // ── Game theme (chase-8-bit) ──
  playTheme() {
    if (!this.musicEnabled) return;
    const t = this.sounds.get('bgm-game');
    if (t && !t.playing()) t.play();
  }

  stopTheme() {
    this.sounds.get('bgm-game')?.stop();
  }

  /** HUD start/stop button — flips the theme and returns the new on/off state. */
  toggleMusic(): boolean {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled) this.playTheme();
    else this.stopTheme();
    return this.musicEnabled;
  }

  isMusicOn(): boolean {
    return this.musicEnabled;
  }

  // ── Running-on-grass loop (driven by player movement) ──
  startRunning() {
    const r = this.sounds.get('running');
    if (r && !r.playing()) r.play();
  }

  stopRunning() {
    const r = this.sounds.get('running');
    if (r && r.playing()) r.stop();
  }
}

export const audioManager = AudioManager.getInstance();
