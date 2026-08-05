import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import './ShortcutRunnerGame.css';
import { appendLevelScore } from './levelScoreHistory';
import { ScoreProgressChart } from './ScoreProgressChart';
import { displayShortcut, keyboardEventToShortcut, normalizeShortcut } from './shortcut';
import { useGameAudio } from './useGameAudio';

export interface ShortcutLevel {
  name: string;
  shortcodes: Record<string, string>;
  /** Scrolling-speed multiplier. 1 is normal, 1.5 is 50% faster. */
  speed?: number;
}

export interface ShortcutGameStats {
  correct: number;
  mistakes: number;
  missed: number;
  score: number;
  longestStreak: number;
}

/**
 * Derives accuracy percent from a finished run's stats.
 *
 * @param runStats - Correct / mistake / miss counts from the run.
 * @returns Rounded accuracy from 0–100.
 */
function accuracyFromStats(runStats: ShortcutGameStats): number {
  const attempts = runStats.correct + runStats.mistakes + runStats.missed;
  return attempts === 0 ? 0 : Math.round((runStats.correct / attempts) * 100);
}

export interface ShortcutRunnerGameProps {
  levels: ShortcutLevel[];
  width?: number;
  height?: number;
  roundsPerLevel?: number;
  /** Base time for an obstacle to reach the runner at speed 1. */
  roundDurationMs?: number;
  initialMuted?: boolean;
  className?: string;
  onLevelComplete?: (level: ShortcutLevel, stats: ShortcutGameStats) => void;
}

interface ShortcutTask {
  action: string;
  shortcut: string;
  normalizedShortcut: string;
}

type Screen = 'menu' | 'playing' | 'complete';
type RoundState = 'approaching' | 'cleared' | 'hit';
type RoundOutcome = 'correct' | 'missed';

interface Feedback {
  type: 'success' | 'error' | 'miss' | 'hint';
  text: string;
}

const START_X = 91;
const COLLISION_X = 21;
const END_X = -12;
const MIN_LEVEL_SPEED = 0.25;
const MAX_LEVEL_SPEED = 5;

const EMPTY_STATS: ShortcutGameStats = {
  correct: 0,
  mistakes: 0,
  missed: 0,
  score: 0,
  longestStreak: 0
};

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = result[index];
    const replacement = result[swapIndex];
    if (current === undefined || replacement === undefined) continue;
    result[index] = replacement;
    result[swapIndex] = current;
  }
  return result;
}

function makeTaskDeck(level: ShortcutLevel, requestedRounds: number): ShortcutTask[] {
  const source = Object.entries(level.shortcodes)
    .filter(([shortcut, action]) => shortcut.trim() && action.trim())
    .map(([shortcut, action]) => ({
      action,
      shortcut,
      normalizedShortcut: normalizeShortcut(shortcut)
    }))
    .filter((task) => task.normalizedShortcut.length > 0);

  if (source.length === 0) return [];

  const rounds = Math.max(requestedRounds, source.length);
  const result: ShortcutTask[] = [];

  while (result.length < rounds) {
    const batch = shuffled(source);
    const previous = result.at(-1);
    if (
      previous &&
      batch.length > 1 &&
      batch[0]?.normalizedShortcut === previous.normalizedShortcut
    ) {
      const first = batch[0];
      const second = batch[1];
      if (first && second) {
        batch[0] = second;
        batch[1] = first;
      }
    }
    result.push(...batch);
  }

  return result.slice(0, rounds);
}

function updateStats(
  current: ShortcutGameStats,
  outcome: RoundOutcome | 'mistake',
  streak: number
): ShortcutGameStats {
  if (outcome === 'mistake') {
    return {
      ...current,
      mistakes: current.mistakes + 1,
      score: Math.max(0, current.score - 15)
    };
  }

  if (outcome === 'missed') {
    return {
      ...current,
      missed: current.missed + 1,
      score: Math.max(0, current.score - 40)
    };
  }

  return {
    ...current,
    correct: current.correct + 1,
    score: current.score + 100 + Math.min(streak * 10, 100),
    longestStreak: Math.max(current.longestStreak, streak)
  };
}

function getLevelSpeed(level: ShortcutLevel | undefined): number {
  const speed = level?.speed ?? 1;
  if (!Number.isFinite(speed)) return 1;
  return Math.min(Math.max(speed, MIN_LEVEL_SPEED), MAX_LEVEL_SPEED);
}

function formatLevelSpeed(level: ShortcutLevel): string {
  const speed = getLevelSpeed(level);
  return `${Number.isInteger(speed) ? speed.toFixed(0) : speed.toFixed(2).replace(/0$/, '')}× speed`;
}

function ProgressiveShortcutHint({
  keys,
  revealedCount
}: {
  keys: string[];
  revealedCount: number;
}) {
  const visibleKeys = keys.slice(0, revealedCount);
  const incomplete = revealedCount < keys.length;

  return (
    <div
      className="hcsr-progressive-hint"
      aria-label={`Hint: ${visibleKeys.join(' plus ')}${incomplete ? ' and more' : ''}`}
    >
      {visibleKeys.map((key, index) => (
        <span className="hcsr-progressive-key" key={`${key}-${index}`}>
          {index > 0 && <span aria-hidden="true">+</span>}
          <kbd>{key}</kbd>
        </span>
      ))}
      {incomplete && (
        <span className="hcsr-progressive-plus" aria-hidden="true">
          +
        </span>
      )}
    </div>
  );
}

function RunnerIcon() {
  return (
    <svg
      className="hcsr-runner-icon"
      viewBox="0 0 64 52"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <g className="hcsr-runner-body">
        <rect x="31" y="3" width="23" height="6" />
        <rect x="27" y="9" width="31" height="9" />
        <rect x="27" y="18" width="20" height="7" />
        <rect x="22" y="20" width="25" height="10" />
        <rect x="16" y="25" width="28" height="13" />
        <rect x="10" y="28" width="12" height="8" />
        <rect x="4" y="24" width="12" height="7" />
        <rect x="0" y="20" width="8" height="5" />
        <rect x="43" y="24" width="11" height="4" />
        <rect x="50" y="28" width="4" height="5" />
        <rect x="23" y="37" width="8" height="11" />
        <rect x="18" y="46" width="13" height="5" />
        <rect x="38" y="36" width="8" height="12" />
        <rect x="38" y="46" width="13" height="5" />
      </g>
      <rect x="48" y="11" width="4" height="4" className="hcsr-runner-eye" />
      <rect x="48" y="20" width="10" height="2" className="hcsr-runner-detail" />
    </svg>
  );
}

function CactusIcon() {
  return (
    <svg className="hcsr-cactus-icon" viewBox="0 0 54 82" aria-hidden="true">
      <path d="M21 79V20c0-8 12-8 12 0v16h4V29c0-7 11-7 11 0v16c0 6-5 11-11 11h-4v23ZM21 51h-5C9 51 5 46 5 40V29c0-7 11-7 11 0v10h5Z" />
      <path d="M12 79h32" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 1.5 4 4m0-4-4 4" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4Zm12-1a6 6 0 0 1 0 8m2.5-10.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

export function ShortcutRunnerGame({
  levels,
  width = 600,
  height = 600,
  roundsPerLevel = 6,
  roundDurationMs = 5000,
  initialMuted = false,
  className = '',
  onLevelComplete
}: ShortcutRunnerGameProps) {
  const [screen, setScreen] = useState<Screen>('menu');
  const [selectedLevelIndex, setSelectedLevelIndex] = useState(0);
  const [tasks, setTasks] = useState<ShortcutTask[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [roundState, setRoundState] = useState<RoundState>('approaching');
  const [obstacleX, setObstacleX] = useState(START_X);
  const [jumping, setJumping] = useState(false);
  const [stumbling, setStumbling] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hintKeyCount, setHintKeyCount] = useState(0);
  const [muted, setMuted] = useState(initialMuted);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState<ShortcutGameStats>(EMPTY_STATS);
  const [streak, setStreak] = useState(0);
  /** Score values for the selected level after the latest completed run is appended. */
  const [levelScoreHistory, setLevelScoreHistory] = useState<number[]>([]);

  const gameRef = useRef<HTMLDivElement | null>(null);
  const obstacleXRef = useRef(START_X);
  const roundStateRef = useRef<RoundState>('approaching');
  const statsRef = useRef<ShortcutGameStats>(EMPTY_STATS);
  const streakRef = useRef(0);
  const transitionTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const hintKeyCountRef = useRef(0);

  const { playCorrect, playMiss, playWrong, startMusic, stopMusic } = useGameAudio(muted);
  const selectedLevel = levels[selectedLevelIndex];
  const currentTask = tasks[roundIndex];
  const currentShortcutKeys = useMemo(
    () => (currentTask ? displayShortcut(currentTask.normalizedShortcut) : []),
    [currentTask]
  );
  const keyCount = currentShortcutKeys.length;
  const activeLevelSpeed = getLevelSpeed(selectedLevel);

  const rootStyle = {
    '--hcsr-width': `${width}px`,
    '--hcsr-height': `${height}px`,
    'width': `${width}px`,
    'height': `${height}px`
  } as CSSProperties;

  const clearTimers = useCallback(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  }, []);

  const clearFeedbackLater = useCallback((delayMs = 1100) => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, delayMs);
  }, []);

  const focusGame = useCallback(() => {
    window.requestAnimationFrame(() => gameRef.current?.focus());
  }, []);

  const resetRound = useCallback(() => {
    obstacleXRef.current = START_X;
    roundStateRef.current = 'approaching';
    setObstacleX(START_X);
    setRoundState('approaching');
    setJumping(false);
    setStumbling(false);
    setFeedback(null);
    hintKeyCountRef.current = 0;
    setHintKeyCount(0);
    focusGame();
  }, [focusGame]);

  const startLevel = useCallback(
    (levelIndex: number) => {
      const level = levels[levelIndex];
      if (!level) return;

      const deck = makeTaskDeck(level, roundsPerLevel);
      if (deck.length === 0) return;

      clearTimers();
      setSelectedLevelIndex(levelIndex);
      setTasks(deck);
      setRoundIndex(0);
      setStats(EMPTY_STATS);
      statsRef.current = EMPTY_STATS;
      setStreak(0);
      streakRef.current = 0;
      setPaused(false);
      setScreen('playing');
      resetRound();
      startMusic();
    },
    [clearTimers, levels, resetRound, roundsPerLevel, startMusic]
  );

  const returnToMenu = useCallback(() => {
    clearTimers();
    stopMusic();
    setPaused(false);
    setScreen('menu');
    setTasks([]);
    setRoundIndex(0);
    setFeedback(null);
    hintKeyCountRef.current = 0;
    setHintKeyCount(0);
  }, [clearTimers, stopMusic]);

  const finishRound = useCallback(
    (outcome: RoundOutcome) => {
      if (roundStateRef.current !== 'approaching') return;

      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }

      const nextState: RoundState = outcome === 'correct' ? 'cleared' : 'hit';
      roundStateRef.current = nextState;
      setRoundState(nextState);

      let nextStreak = 0;
      if (outcome === 'correct') {
        nextStreak = streakRef.current + 1;
        streakRef.current = nextStreak;
        setStreak(nextStreak);
        setJumping(true);
        setFeedback({ type: 'success', text: 'Correct — obstacle cleared!' });
        playCorrect();

        window.requestAnimationFrame(() => {
          obstacleXRef.current = END_X;
          setObstacleX(END_X);
        });
      } else {
        streakRef.current = 0;
        setStreak(0);
        setStumbling(true);
        hintKeyCountRef.current = keyCount;
        setHintKeyCount(keyCount);
        setFeedback({ type: 'miss', text: 'Missed it. Study the shortcut and try again.' });
        playMiss();
      }

      const nextStats = updateStats(statsRef.current, outcome, nextStreak);
      statsRef.current = nextStats;
      setStats(nextStats);

      transitionTimerRef.current = window.setTimeout(
        () => {
          const nextIndex = roundIndex + 1;
          if (nextIndex >= tasks.length) {
            stopMusic();
            setPaused(false);
            setJumping(false);
            setStumbling(false);
            const completedLevel = levels[selectedLevelIndex];
            if (completedLevel) {
              const history = appendLevelScore(completedLevel.name, {
                score: nextStats.score,
                accuracy: accuracyFromStats(nextStats),
                longestStreak: nextStats.longestStreak,
                at: Date.now()
              });
              setLevelScoreHistory(history.map((entry) => entry.score));
              onLevelComplete?.(completedLevel, nextStats);
            } else {
              setLevelScoreHistory([]);
            }
            setScreen('complete');
            return;
          }

          setRoundIndex(nextIndex);
          resetRound();
        },
        outcome === 'correct' ? 720 : 1000
      );
    },
    [
      keyCount,
      levels,
      onLevelComplete,
      playCorrect,
      playMiss,
      resetRound,
      roundIndex,
      selectedLevelIndex,
      stopMusic,
      tasks.length
    ]
  );

  useEffect(() => {
    if (screen !== 'playing' || roundState !== 'approaching' || paused) return;

    let animationFrame = 0;
    let lastTime = performance.now();
    const travelDistance = START_X - COLLISION_X;
    const effectiveDurationMs = roundDurationMs / activeLevelSpeed;
    const speedPerSecond = travelDistance / Math.max(effectiveDurationMs / 1000, 0.45);

    const tick = (time: number) => {
      const deltaSeconds = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const nextX = obstacleXRef.current - speedPerSecond * deltaSeconds;
      obstacleXRef.current = nextX;
      setObstacleX(nextX);

      if (nextX <= COLLISION_X) {
        finishRound('missed');
        return;
      }

      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeLevelSpeed, finishRound, paused, roundDurationMs, roundState, screen]);

  useEffect(() => clearTimers, [clearTimers]);

  /**
   * Reveals the next key in the progressive shortcut hint for the current round.
   *
   * @param options.announce - When true (default), updates the feedback line with
   *   a hint message. Pass false when the caller already shows its own feedback.
   * @returns Whether a previously hidden key was revealed.
   */
  const revealNextHintKey = useCallback(
    (options?: { announce?: boolean }): boolean => {
      if (keyCount === 0) return false;

      const previousCount = hintKeyCountRef.current;
      const nextCount = Math.min(previousCount + 1, keyCount);
      if (nextCount === previousCount) return false;

      hintKeyCountRef.current = nextCount;
      setHintKeyCount(nextCount);

      if (options?.announce !== false) {
        setFeedback({
          type: 'hint',
          text: nextCount >= keyCount ? 'Full shortcut revealed.' : 'One more key revealed.'
        });
        clearFeedbackLater(900);
      }

      return true;
    },
    [clearFeedbackLater, keyCount]
  );

  const togglePaused = useCallback(() => {
    const nextPaused = !paused;
    setPaused(nextPaused);

    if (nextPaused) {
      stopMusic();
      setFeedback({ type: 'hint', text: 'Paused — press P to resume.' });
    } else {
      startMusic();
      setFeedback(null);
      focusGame();
    }
  }, [focusGame, paused, startMusic, stopMusic]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (screen !== 'playing' || roundStateRef.current !== 'approaching' || event.repeat) {
        return;
      }

      const enteredShortcut = keyboardEventToShortcut(event.nativeEvent);
      if (!enteredShortcut) return;

      event.preventDefault();
      event.stopPropagation();

      if (paused) {
        if (enteredShortcut === 'p') togglePaused();
        return;
      }

      if (enteredShortcut === 'p' && currentTask?.normalizedShortcut !== 'p') {
        togglePaused();
        return;
      }

      if (enteredShortcut === 'h' && currentTask?.normalizedShortcut !== 'h') {
        revealNextHintKey();
        return;
      }

      if (enteredShortcut === currentTask?.normalizedShortcut) {
        if (feedbackTimerRef.current !== null) {
          window.clearTimeout(feedbackTimerRef.current);
          feedbackTimerRef.current = null;
        }
        finishRound('correct');
        return;
      }

      playWrong();
      const revealedHint = revealNextHintKey({ announce: false });
      const nextStats = updateStats(statsRef.current, 'mistake', streakRef.current);
      statsRef.current = nextStats;
      setStats(nextStats);
      setFeedback({
        type: 'error',
        text: revealedHint
          ? `That was ${displayShortcut(enteredShortcut).join(' + ')}. Hint revealed — try again.`
          : `That was ${displayShortcut(enteredShortcut).join(' + ')}. Try again.`
      });
      clearFeedbackLater();
    },
    [
      clearFeedbackLater,
      currentTask,
      finishRound,
      paused,
      playWrong,
      revealNextHintKey,
      screen,
      togglePaused
    ]
  );

  const accuracy = useMemo(() => {
    const attempts = stats.correct + stats.mistakes + stats.missed;
    return attempts === 0 ? 0 : Math.round((stats.correct / attempts) * 100);
  }, [stats]);

  if (levels.length === 0) {
    return (
      <div className={`hcsr-root ${className}`} style={rootStyle}>
        <div className="hcsr-empty">
          <strong>No shortcut levels configured</strong>
          <span>Pass at least one level containing a non-empty shortcodes map.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={gameRef}
      className={`hcsr-root ${className}`.trim()}
      style={rootStyle}
      tabIndex={0}
      onKeyDownCapture={handleKeyDown}
      onPointerDown={() => screen === 'playing' && focusGame()}
      aria-label="HarborClient shortcut training game"
    >
      <header className="hcsr-header">
        <div>
          <span className="hcsr-kicker">HarborClient Training</span>
          <strong>Shortcut Sprint</strong>
        </div>
        <button
          type="button"
          className="hcsr-icon-button"
          onClick={() => setMuted((value) => !value)}
          aria-label={muted ? 'Unmute music' : 'Mute music'}
          title={muted ? 'Unmute music' : 'Mute music'}
        >
          <VolumeIcon muted={muted} />
        </button>
      </header>

      {screen === 'menu' && (
        <main className="hcsr-menu">
          <div className="hcsr-level-heading">
            <div>
              <span className="hcsr-eyebrow">Build muscle memory</span>
              <h2>Choose a shortcut level</h2>
            </div>
            <p>Beat the cactus before it reaches the dinosaur.</p>
          </div>

          <div className="hcsr-level-list" role="radiogroup" aria-label="Shortcut levels">
            {levels.map((level, index) => {
              const shortcutCount = Object.keys(level.shortcodes).length;
              const selected = index === selectedLevelIndex;
              return (
                <button
                  type="button"
                  className={`hcsr-level-card${selected ? ' hcsr-level-card--selected' : ''}`}
                  key={`${level.name}-${index}`}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSelectedLevelIndex(index)}
                >
                  <span className="hcsr-level-number">{index + 1}</span>
                  <span>
                    <strong>{level.name}</strong>
                    <small>
                      {shortcutCount} shortcut{shortcutCount === 1 ? '' : 's'} ·{' '}
                      {formatLevelSpeed(level)}
                    </small>
                  </span>
                  <span className="hcsr-level-check" aria-hidden="true">
                    ✓
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="hcsr-primary-button"
            onClick={() => startLevel(selectedLevelIndex)}
            disabled={!selectedLevel || Object.keys(selectedLevel.shortcodes).length === 0}
          >
            Start {selectedLevel?.name ?? 'level'}
          </button>
        </main>
      )}

      {screen === 'playing' && currentTask && selectedLevel && (
        <main className={`hcsr-game${paused ? ' hcsr-game--paused' : ''}`}>
          <div className="hcsr-status-row">
            <span>
              {selectedLevel.name} · {activeLevelSpeed}×
            </span>
            <span>
              Round {roundIndex + 1}/{tasks.length}
            </span>
            <span>{stats.score} pts</span>
          </div>

          <div className="hcsr-prompt" aria-live="polite">
            <span>Use the shortcut for</span>
            <strong>{currentTask.action}</strong>
            <div className="hcsr-hint-slot">
              {hintKeyCount > 0 && (
                <ProgressiveShortcutHint keys={currentShortcutKeys} revealedCount={hintKeyCount} />
              )}
            </div>
          </div>

          <div className="hcsr-track" aria-hidden="true">
            <div className="hcsr-control-guide">
              <span>
                <kbd>H</kbd> Hint
              </span>
              <span>
                <kbd>P</kbd> Pause
              </span>
            </div>
            {paused && (
              <div className="hcsr-pause-overlay">
                <strong>Paused</strong>
                <span>Press P to resume</span>
              </div>
            )}
            <div
              className="hcsr-cloud hcsr-cloud--one"
              style={{ animationDuration: `${12 / activeLevelSpeed}s` }}
            />
            <div
              className="hcsr-cloud hcsr-cloud--two"
              style={{ animationDuration: `${17 / activeLevelSpeed}s` }}
            />
            <div className="hcsr-horizon" />
            <div className="hcsr-ground-lines" />

            <div
              className={`hcsr-runner${jumping ? ' hcsr-runner--jumping' : ''}${
                stumbling ? ' hcsr-runner--stumbling' : ''
              }`}
            >
              <RunnerIcon />
            </div>

            <div
              className={`hcsr-obstacle hcsr-obstacle--${roundState}`}
              style={{ left: `${obstacleX}%` }}
            >
              <CactusIcon />
            </div>
          </div>

          <div
            className={`hcsr-feedback${feedback ? ` hcsr-feedback--${feedback.type}` : ''}`}
            aria-live="assertive"
          >
            {feedback?.text ?? 'Press H for a hint · Press P to pause.'}
          </div>

          <div className="hcsr-game-footer">
            <div className="hcsr-stat">
              <span>Streak</span>
              <strong>{streak}</strong>
            </div>
            <div className="hcsr-key-count">
              {keyCount} {keyCount === 1 ? 'key' : 'keys'}
            </div>
            <button type="button" className="hcsr-text-button" onClick={returnToMenu}>
              Exit
            </button>
          </div>
        </main>
      )}

      {screen === 'complete' && selectedLevel && (
        <main className="hcsr-complete">
          <div className="hcsr-complete-mark">✓</div>
          <span className="hcsr-eyebrow">Level complete</span>
          <h2>{selectedLevel.name}</h2>
          <p>
            You cleared {stats.correct} of {tasks.length} obstacles.
          </p>

          <ScoreProgressChart scores={levelScoreHistory} />

          <div className="hcsr-results">
            <div>
              <span>Score</span>
              <strong>{stats.score}</strong>
            </div>
            <div>
              <span>Accuracy</span>
              <strong>{accuracy}%</strong>
            </div>
            <div>
              <span>Best streak</span>
              <strong>{stats.longestStreak}</strong>
            </div>
          </div>

          <div className="hcsr-complete-actions">
            <button
              type="button"
              className="hcsr-primary-button"
              onClick={() => startLevel(selectedLevelIndex)}
            >
              Play again
            </button>
            <button type="button" className="hcsr-secondary-button" onClick={returnToMenu}>
              Choose level
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
