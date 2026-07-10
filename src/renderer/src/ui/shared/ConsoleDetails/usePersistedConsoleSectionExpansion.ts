import { useAccordionProvider } from '@szhsin/react-accordion';
import { useCallback, useEffect, useState } from 'react';

/** Stable accordion keys for console detail sections. */
export const CONSOLE_SECTION_KEYS = ['general', 'request', 'response', 'output', 'trace'] as const;

/** Accordion item key for a console detail section. */
export type ConsoleSectionKey = (typeof CONSOLE_SECTION_KEYS)[number];

/** Expanded/collapsed flags for each console detail section. */
export type ConsoleSectionExpansionState = Record<ConsoleSectionKey, boolean>;

/** localStorage key for global console section expansion. */
export const CONSOLE_SECTIONS_STORAGE_KEY = 'hc.consoleSections';

interface PersistedConsoleSectionExpansionResult {
  /**
   * Expanded flags keyed by console detail section id.
   */
  sections: ConsoleSectionExpansionState;

  /**
   * Accordion provider wired to persisted section expansion.
   */
  accordion: ReturnType<typeof useAccordionProvider>;
}

/**
 * Returns whether a string is a known console detail section key.
 *
 * @param key - Candidate accordion item key.
 */
export function isConsoleSectionKey(key: string): key is ConsoleSectionKey {
  return (CONSOLE_SECTION_KEYS as readonly string[]).includes(key);
}

/**
 * Returns the default expansion state with every console section expanded.
 */
export function defaultConsoleSectionExpansion(): ConsoleSectionExpansionState {
  return {
    general: true,
    request: true,
    response: true,
    output: true,
    trace: true
  };
}

/**
 * Parses persisted console section expansion JSON.
 *
 * Unknown keys are ignored. Missing known keys default to expanded.
 *
 * @param raw - Stored JSON string.
 */
export function parsePersistedConsoleSectionExpansion(
  raw: string
): ConsoleSectionExpansionState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const next = defaultConsoleSectionExpansion();

    for (const key of CONSOLE_SECTION_KEYS) {
      const value = record[key];
      if (typeof value === 'boolean') {
        next[key] = value;
      }
    }

    return next;
  } catch {
    return null;
  }
}

/**
 * Loads persisted console section expansion from localStorage.
 */
export function loadPersistedConsoleSectionExpansion(): ConsoleSectionExpansionState {
  try {
    const raw = localStorage.getItem(CONSOLE_SECTIONS_STORAGE_KEY);
    if (!raw) {
      return defaultConsoleSectionExpansion();
    }

    return parsePersistedConsoleSectionExpansion(raw) ?? defaultConsoleSectionExpansion();
  } catch {
    return defaultConsoleSectionExpansion();
  }
}

/**
 * Persists console section expansion to localStorage.
 *
 * @param state - Expanded flags for each console detail section.
 */
export function persistConsoleSectionExpansion(state: ConsoleSectionExpansionState): void {
  try {
    localStorage.setItem(CONSOLE_SECTIONS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota or privacy-mode failures.
  }
}

/**
 * Loads and persists global console detail section expansion via localStorage.
 */
export function usePersistedConsoleSectionExpansion(): PersistedConsoleSectionExpansionResult {
  const [sections, setSections] = useState<ConsoleSectionExpansionState>(() =>
    loadPersistedConsoleSectionExpansion()
  );

  /**
   * Updates in-memory section expansion and mirrors the change to localStorage.
   */
  const applySectionExpanded = useCallback((key: string, expanded: boolean): void => {
    if (!isConsoleSectionKey(key)) {
      return;
    }

    setSections((current) => {
      if (current[key] === expanded) {
        return current;
      }

      const next = { ...current, [key]: expanded };
      persistConsoleSectionExpansion(next);
      return next;
    });
  }, []);

  const accordion = useAccordionProvider({
    allowMultiple: true,
    transition: true,
    transitionTimeout: 200,
    mountOnEnter: true,
    onStateChange: ({ key, current }) => {
      applySectionExpanded(String(key), current.isEnter);
    }
  });
  const { stateMap, toggle } = accordion;

  /**
   * Pushes persisted expansion into the accordion when section state changes.
   * `stateMap` is read when section flags change but omitted from deps so user
   * toggles do not re-trigger sync and snap sections back open.
   */
  useEffect(() => {
    for (const key of CONSOLE_SECTION_KEYS) {
      const wantExpanded = sections[key];
      const isExpanded = stateMap.get(key)?.isEnter;
      if (isExpanded !== wantExpanded) {
        toggle(key, wantExpanded);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stateMap intentionally excluded; see docblock
  }, [sections, toggle]);

  return { sections, accordion };
}
