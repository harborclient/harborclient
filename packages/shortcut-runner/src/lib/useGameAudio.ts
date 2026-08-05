import { useCallback, useEffect, useRef } from 'react';

type WebkitWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const MELODY = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];

/**
 * Output level of the shared master bus when unmuted. Every tone is summed
 * here, so this stays below 1 to leave headroom for overlapping notes.
 */
const MASTER_GAIN = 0.5;

/**
 * Peak gain of a melody note. Music competes with the app's own audio, so it
 * sits close to the effect levels rather than acting as a faint background bed.
 */
const MELODY_GAIN = 0.11;

/**
 * Peak gain of the octave-down note played on every fourth beat.
 */
const BASS_GAIN = 0.07;

export interface GameAudioController {
  playCorrect: () => void;
  playMiss: () => void;
  playWrong: () => void;
  startMusic: () => void;
  stopMusic: () => void;
}

export function useGameAudio(muted: boolean): GameAudioController {
  const contextRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const melodyStepRef = useRef(0);
  const mutedRef = useRef(muted);

  mutedRef.current = muted;

  const ensureContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;

    if (!contextRef.current) {
      const AudioContextClass = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!AudioContextClass) return null;

      const context = new AudioContextClass();
      const master = context.createGain();
      master.gain.value = mutedRef.current ? 0 : MASTER_GAIN;
      master.connect(context.destination);
      contextRef.current = context;
      masterRef.current = master;
    }

    void contextRef.current.resume();
    return contextRef.current;
  }, []);

  const playTone = useCallback(
    (
      frequency: number,
      duration: number,
      options?: { delay?: number; gain?: number; type?: OscillatorType }
    ) => {
      const context = ensureContext();
      const master = masterRef.current;
      if (!context || !master) return;

      const start = context.currentTime + (options?.delay ?? 0);
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = options?.type ?? 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(options?.gain ?? 0.08, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    },
    [ensureContext]
  );

  const scheduleMusicNote = useCallback(() => {
    const frequency = MELODY[melodyStepRef.current % MELODY.length] ?? 329.63;
    melodyStepRef.current += 1;
    playTone(frequency, 0.24, { gain: MELODY_GAIN, type: 'triangle' });

    if (melodyStepRef.current % 4 === 1) {
      playTone(frequency / 2, 0.52, { gain: BASS_GAIN, type: 'sine' });
    }
  }, [playTone]);

  const startMusic = useCallback(() => {
    ensureContext();
    if (timerRef.current !== null) return;

    scheduleMusicNote();
    timerRef.current = window.setInterval(scheduleMusicNote, 330);
  }, [ensureContext, scheduleMusicNote]);

  const stopMusic = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const playCorrect = useCallback(() => {
    playTone(523.25, 0.12, { gain: 0.09, type: 'triangle' });
    playTone(659.25, 0.18, { delay: 0.08, gain: 0.08, type: 'triangle' });
  }, [playTone]);

  const playWrong = useCallback(() => {
    playTone(185, 0.16, { gain: 0.07, type: 'square' });
  }, [playTone]);

  const playMiss = useCallback(() => {
    playTone(220, 0.15, { gain: 0.08, type: 'sawtooth' });
    playTone(146.83, 0.25, { delay: 0.1, gain: 0.07, type: 'sawtooth' });
  }, [playTone]);

  /**
   * Ramps the master bus toward silence or full level whenever the mute control
   * is toggled, so the change is smooth instead of clicking.
   */
  useEffect(() => {
    const context = contextRef.current;
    const master = masterRef.current;
    if (!context || !master) return;

    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, context.currentTime, 0.03);
  }, [muted]);

  useEffect(
    () => () => {
      stopMusic();
      if (contextRef.current) {
        void contextRef.current.close();
      }
    },
    [stopMusic]
  );

  return { playCorrect, playMiss, playWrong, startMusic, stopMusic };
}
