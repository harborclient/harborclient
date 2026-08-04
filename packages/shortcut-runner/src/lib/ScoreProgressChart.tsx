import type { JSX } from 'react';

interface Props {
  /**
   * Score values for each retained run on this level, oldest first.
   */
  scores: number[];
}

/**
 * CSS bar chart of per-level score history for the level-complete screen.
 *
 * @param props - Chart scores (last entry is the current run).
 * @returns Accessible progress chart, or null when there are no scores.
 */
export function ScoreProgressChart({ scores }: Props): JSX.Element | null {
  if (scores.length === 0) {
    return null;
  }

  const maxScore = Math.max(...scores, 1);
  const latestScore = scores[scores.length - 1] ?? 0;
  const bestScore = Math.max(...scores);
  const bestIndex = scores.lastIndexOf(bestScore);

  const ariaLabel = [
    `Score progress over ${scores.length} attempt${scores.length === 1 ? '' : 's'}.`,
    `Latest score ${latestScore}.`,
    `Personal best ${bestScore}.`
  ].join(' ');

  return (
    <div className="hcsr-progress-chart" role="img" aria-label={ariaLabel}>
      <div className="hcsr-progress-chart-bars">
        {scores.map((score, index) => {
          const isCurrent = index === scores.length - 1;
          const isBest = index === bestIndex;
          const heightPercent = score <= 0 ? 0 : Math.max(8, Math.round((score / maxScore) * 100));

          const className = [
            'hcsr-progress-chart-bar',
            isCurrent ? 'hcsr-progress-chart-bar--current' : '',
            isBest ? 'hcsr-progress-chart-bar--best' : ''
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={`${index}-${score}`}
              className={className}
              style={{ height: `${heightPercent}%` }}
              title={`Run ${index + 1}: ${score}${isBest ? ' (personal best)' : ''}`}
            />
          );
        })}
      </div>
      <div className="hcsr-progress-chart-caption">
        <span>Progress</span>
        <span>Best {bestScore}</span>
      </div>
    </div>
  );
}
