/**
 * GÓC POS — Barista Order Notification Chime Engine
 * Uses Web Audio API synthesizer for clean, pleasant, 0-latency ding-dong chime.
 * 100% offline, requires 0 external audio assets, works seamlessly across iOS and Android.
 */

const STORAGE_KEY = 'goc_pos_audio_chime_muted';

let audioCtx = null;
let inMemoryMuted = false;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Auto-warmup Web Audio context on first user touch/click for true 0ms chime playback
if (typeof window !== 'undefined') {
  const warmUpAudio = () => {
    try {
      getAudioContext();
    } catch (_) {}
  };
  window.addEventListener('pointerdown', warmUpAudio, { once: true, passive: true });
  window.addEventListener('keydown', warmUpAudio, { once: true, passive: true });
}

export function isAudioMuted() {
  if (typeof window === 'undefined') return inMemoryMuted;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === 'true' : inMemoryMuted;
  } catch {
    return inMemoryMuted;
  }
}

export function setAudioMuted(muted) {
  inMemoryMuted = Boolean(muted);
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, muted ? 'true' : 'false');
  } catch {}
}

export function toggleAudioMuted() {
  const current = isAudioMuted();
  const next = !current;
  setAudioMuted(next);
  return next;
}

/**
 * Plays a pleasant double-chime (880Hz A5 -> 1318.5Hz E6)
 */
export function playOrderChime() {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // First Bell Tone (880 Hz - A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.24, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second Bell Tone (1318.5 Hz - E6, pure bell)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.5, now + 0.12);
    gain2.gain.setValueAtTime(0.32, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.65);
  } catch (err) {
    // Graceful fallback if audio is not permitted yet
    console.debug('[AudioChime] Playback suspended or not allowed:', err);
  }
}
