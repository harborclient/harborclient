import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

/**
 * Builds a HarborClient hand-authored icon definition compatible with FaIcon.
 *
 * @param iconName - Stable identifier for the custom glyph.
 * @param svgPathData - SVG path data on a 512-unit canvas.
 * @param width - Icon width in Font Awesome icon tuple units.
 * @param height - Icon height in Font Awesome icon tuple units.
 * @returns Icon definition accepted by FontAwesomeIcon without library registration.
 */
function customIcon(
  iconName: string,
  svgPathData: string,
  width = 512,
  height = 512
): IconDefinition {
  return {
    prefix: 'fas',
    iconName,
    icon: [width, height, [], '', svgPathData]
  } as IconDefinition;
}

/**
 * Bold chevron with a trailing prompt dash — evokes a command-line prompt for the
 * Action menu's slash-command mode without drawing a full terminal window.
 */
export const iconActionChevronPrompt = customIcon(
  'action-chevron-prompt',
  [
    'M 112 216 h 64 a 16 16 0 0 1 16 16 v 48 a 16 16 0 0 1 -16 16 h -64 a 16 16 0 0 1 -16 -16 v -48 a 16 16 0 0 1 16 -16 z',
    'M 224 128 L 384 256 L 224 384 L 288 384 L 416 256 L 288 128 z'
  ].join(' ')
);

/**
 * Four solid rounded lobes arranged like the macOS command key, tying the Action
 * menu footer toggle to its Cmd/Ctrl+Shift+P shortcut. Lobes are inset with ~64px
 * canvas padding so none clip when Font Awesome scales the glyph in the footer.
 */
export const iconActionCommandClover = customIcon(
  'action-command-clover',
  [
    'M 256 68 A 56 56 0 1 1 256 180 A 56 56 0 1 1 256 68 Z',
    'M 256 332 A 56 56 0 1 1 256 444 A 56 56 0 1 1 256 332 Z',
    'M 68 256 A 56 56 0 1 1 180 256 A 56 56 0 1 1 68 256 Z',
    'M 332 256 A 56 56 0 1 1 444 256 A 56 56 0 1 1 332 256 Z'
  ].join(' ')
);

/**
 * Compact four-point sparkle with the upper-right arm extended into an arrowhead,
 * blending quick-trigger energy with directional action.
 */
export const iconActionSpark = customIcon(
  'action-spark',
  [
    'M 256 112 L 284 216 L 368 232 L 448 256 L 368 280 L 284 296 L 256 400 L 228 296 L 144 280 L 64 256 L 144 232 L 228 216 z',
    'M 368 232 L 448 256 L 368 280 L 392 256 z'
  ].join(' ')
);

/**
 * Three rounded bars of increasing length, arranged like filtered rows in a command
 * palette rather than a plain equal-width hamburger menu.
 */
export const iconActionSteppedRows = customIcon(
  'action-stepped-rows',
  [
    'M 128 152 h 128 a 24 24 0 0 1 24 24 v 0 a 24 24 0 0 1 -24 24 h -128 a 24 24 0 0 1 -24 -24 v 0 a 24 24 0 0 1 24 -24 z',
    'M 128 232 h 224 a 24 24 0 0 1 24 24 v 0 a 24 24 0 0 1 -24 24 h -224 a 24 24 0 0 1 -24 -24 v 0 a 24 24 0 0 1 24 -24 z',
    'M 128 312 h 320 a 24 24 0 0 1 24 24 v 0 a 24 24 0 0 1 -24 24 h -320 a 24 24 0 0 1 -24 -24 v 0 a 24 24 0 0 1 24 -24 z'
  ].join(' ')
);

/**
 * Bold double chevron (`>>`) — a simple overflow / more-actions affordance that
 * stays legible at the footer's 16px render size.
 */
export const iconActionDoubleChevron = customIcon(
  'action-double-chevron',
  [
    'M 96 128 L 224 256 L 96 384 L 160 384 L 256 256 L 160 128 z',
    'M 256 128 L 384 256 L 256 384 L 320 384 L 416 256 L 320 128 z'
  ].join(' ')
);

/**
 * Corner brackets with a diagonal bolt through the center — trigger an action on a
 * focused target without relying on SVG even-odd fill rules.
 */
export const iconActionTargetTrigger = customIcon(
  'action-target-trigger',
  [
    'M 128 128 H 208 V 168 H 168 V 208 H 128 Z',
    'M 384 128 H 304 V 168 H 344 V 208 H 384 Z',
    'M 128 384 H 168 V 344 H 208 V 384 H 128 Z',
    'M 384 384 H 344 V 344 H 304 V 384 H 384 Z',
    'M 288 160 L 232 288 L 272 288 L 224 416 L 320 240 L 280 240 Z'
  ].join(' ')
);

/**
 * Default Action menu footer icon — command clover concept.
 */
export const iconActionMenu = iconActionCommandClover;

/**
 * Tailwind size classes for the Action menu clover wherever it is shown (22px =
 * default footer icon size plus ~6px).
 */
export const ACTION_MENU_ICON_CLASS = 'h-[22px] w-[22px]';

/**
 * Tailwind classes that enlarge the Action menu clover inside FooterIcon without
 * changing other footer toggles.
 */
export const ACTION_MENU_FOOTER_ICON_CLASS =
  'mr-2 h-8 w-8 [&_.hc-footer-icon-icon]:h-[22px] [&_.hc-footer-icon-icon]:w-[22px]';

/**
 * All Action menu footer icon candidates for preview tooling and future swaps.
 */
export const ACTION_MENU_ICON_CANDIDATES = [
  {
    id: 'chevron-prompt',
    name: 'Chevron prompt',
    code: 'iconActionChevronPrompt',
    icon: iconActionChevronPrompt,
    note: 'Bold chevron with prompt dash — echoes “Type / for commands” without a terminal window.'
  },
  {
    id: 'command-clover',
    name: 'Command clover',
    code: 'iconActionCommandClover',
    icon: iconActionCommandClover,
    note: 'Four solid lobes inspired by the macOS command key — ties to Cmd/Ctrl+Shift+P.'
  },
  {
    id: 'action-spark',
    name: 'Action spark',
    code: 'iconActionSpark',
    icon: iconActionSpark,
    note: 'Four-point sparkle with an extended arrow arm — quick trigger energy.'
  },
  {
    id: 'stepped-rows',
    name: 'Stepped command rows',
    code: 'iconActionSteppedRows',
    icon: iconActionSteppedRows,
    note: 'Three rounded bars of increasing length — filtered command-palette rows.'
  },
  {
    id: 'double-chevron',
    name: 'Double chevron',
    code: 'iconActionDoubleChevron',
    icon: iconActionDoubleChevron,
    note: 'Bold >> overflow affordance — simple and legible at 16px.'
  },
  {
    id: 'target-trigger',
    name: 'Target trigger',
    code: 'iconActionTargetTrigger',
    icon: iconActionTargetTrigger,
    note: 'Corner brackets with a diagonal bolt — trigger an action on a focused target.'
  }
] as const;
