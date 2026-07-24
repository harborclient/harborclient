import type { JSX } from 'react';
import type { ThemeColorToken } from '@harborclient/sdk';
import { CUSTOM_THEME_TOKEN_GROUPS } from '#/shared/types/customTheme';
import { ColorTokenField } from './ColorTokenField';

interface Props {
  /**
   * Current token values in the Designer draft.
   */
  colors: Partial<Record<ThemeColorToken, string>>;

  /**
   * Updates one token value in the Designer draft.
   */
  onChange: (token: ThemeColorToken, value: string) => void;
}

/**
 * Grouped fluid grid of theme color pickers for the Designer form.
 * Columns wrap based on available panel width rather than viewport breakpoints.
 */
export function ColorTokenGrid({ colors, onChange }: Props): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {CUSTOM_THEME_TOKEN_GROUPS.map((group) => (
        <section key={group.label} aria-labelledby={`designer-group-${group.label}`}>
          <h3
            id={`designer-group-${group.label}`}
            className="m-0 mb-3 text-[14px] font-semibold text-text"
          >
            {group.label}
          </h3>
          <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4">
            {group.tokens.map((token) => (
              <ColorTokenField
                key={token}
                token={token}
                value={colors[token] ?? '#000000'}
                onChange={onChange}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
