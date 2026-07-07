import type { JSX } from 'react';
import type { ThemeColorToken } from '@harborclient/sdk';
import { CUSTOM_THEME_TOKEN_GROUPS } from '#/shared/types/customTheme';
import { ColorTokenField } from '#/renderer/src/ui/Plugins/ColorTokenField';

interface Props {
  /**
   * Current token values in the Creator draft.
   */
  colors: Partial<Record<ThemeColorToken, string>>;

  /**
   * Updates one token value in the Creator draft.
   */
  onChange: (token: ThemeColorToken, value: string) => void;
}

/**
 * Grouped 3-column grid of theme color pickers for the Creator form.
 */
export function ColorTokenGrid({ colors, onChange }: Props): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      {CUSTOM_THEME_TOKEN_GROUPS.map((group) => (
        <section key={group.label} aria-labelledby={`creator-group-${group.label}`}>
          <h3
            id={`creator-group-${group.label}`}
            className="m-0 mb-3 text-[14px] font-semibold text-text"
          >
            {group.label}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
