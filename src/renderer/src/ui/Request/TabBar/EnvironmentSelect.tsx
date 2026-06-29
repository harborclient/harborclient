import { Select } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { Environment } from '#/shared/types';

interface Props {
  environments: Environment[];
  activeEnvironmentId: number | null;
  onEnvironmentChange: (id: number | null) => void;
}

/**
 * Environment selector dropdown for the tab bar.
 */
export function EnvironmentSelect({
  environments,
  activeEnvironmentId,
  onEnvironmentChange
}: Props): JSX.Element {
  return (
    <div className="ms-auto flex shrink-0 self-stretch items-center">
      <Select
        className="max-w-[180px] cursor-pointer py-1 bg-sidebar text-[14px] app-no-drag border-none"
        value={activeEnvironmentId ?? ''}
        onChange={(e) => {
          const value = e.target.value;
          onEnvironmentChange(value ? Number(value) : null);
        }}
        aria-label="Active environment"
        title="Active environment"
      >
        <option value="">No Environment</option>
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
