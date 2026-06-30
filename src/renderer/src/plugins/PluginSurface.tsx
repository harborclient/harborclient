import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type JSX } from 'react';
import { buildPluginSurfaceUrl, type PluginContributionKind } from '#/shared/plugin/pluginSurface';

interface Props {
  /** Plugin manifest id. */
  pluginId: string;

  /** Manifest contributes.* id for the surface URL. */
  contributionId: string;

  /** Contribution bucket used by the view webview bootstrap. */
  kind: PluginContributionKind;

  /** Serialized context pushed to the surface webview. */
  context?: unknown;

  /** Optional CSS class applied to the webview element. */
  className?: string;

  /** Optional inline style applied to the webview element. */
  style?: CSSProperties;

  /** Minimum block size for content-sized surfaces. */
  minHeight?: number | string;

  /** Optional contribution sub-slot (content, headerActions, indicator). */
  slot?: 'content' | 'headerActions' | 'indicator';

  /**
   * How the embedded webview sizes itself: grow to guest content height (`content`)
   * or fill the host allocation with internal scroll (`fill`).
   */
  resizeMode?: 'content' | 'fill';
}

interface InstanceProps extends Props {
  /** Resolved plugin surface URL; used as a remount key when the target changes. */
  src: string;
}

/**
 * Parses a CSS length into a numeric pixel floor for content-height resizing.
 *
 * @param value - Minimum height from props.
 * @returns Pixel value when numeric; otherwise zero.
 */
function parseMinHeight(value: number | string | undefined): number {
  if (value == null) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Normalizes a minimum height prop into a valid CSS length for inline styles.
 *
 * @param value - Minimum height from props.
 * @returns CSS length string, or undefined when unset.
 */
function formatMinHeightCss(value: number | string | undefined): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === 'number') {
    return `${value}px`;
  }
  return value;
}

/**
 * Applies absolute fill positioning to a fill-mode webview so it covers its container.
 *
 * @param webview - Embedded plugin webview element.
 */
function applyFillWebviewStyles(webview: Electron.WebviewTag): void {
  webview.style.position = 'absolute';
  webview.style.inset = '0';
  webview.style.width = '100%';
  webview.style.height = '100%';
  webview.style.border = 'none';
  webview.style.background = 'transparent';
}

/** Default inline size for header-actions surfaces before the guest reports its size. */
const HEADER_ACTIONS_DEFAULT_WIDTH = 28;
const HEADER_ACTIONS_DEFAULT_HEIGHT = 34;

/** Default inline size for footer panel indicators before the guest reports its size. */
const INDICATOR_DEFAULT_WIDTH = 12;
const INDICATOR_DEFAULT_HEIGHT = 16;

/**
 * Returns whether a contribution sub-slot uses compact inline guest sizing.
 *
 * @param slot - Contribution sub-slot from props.
 */
function isCompactEmbedSlot(slot: Props['slot']): boolean {
  return slot === 'headerActions' || slot === 'indicator';
}

/**
 * Resolves default compact embed dimensions for header actions and footer indicators.
 *
 * @param slot - Contribution sub-slot from props.
 */
function getCompactEmbedDefaults(slot: Props['slot']): { width: number; height: number } {
  if (slot === 'indicator') {
    return { width: INDICATOR_DEFAULT_WIDTH, height: INDICATOR_DEFAULT_HEIGHT };
  }
  return { width: HEADER_ACTIONS_DEFAULT_WIDTH, height: HEADER_ACTIONS_DEFAULT_HEIGHT };
}

/**
 * Stateful plugin surface instance remounted when `src` changes so resize state resets
 * without synchronous setState calls inside the webview attach effect.
 */
function PluginSurfaceInstance({
  pluginId,
  contributionId,
  kind,
  context,
  className,
  style,
  minHeight,
  slot = 'content',
  resizeMode = 'content',
  src
}: InstanceProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const webviewRef = useRef<Electron.WebviewTag | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const compactDefaults = getCompactEmbedDefaults(slot);
  const [contentHeight, setContentHeight] = useState<number | null>(
    isCompactEmbedSlot(slot) ? compactDefaults.height : null
  );
  const [contentWidth, setContentWidth] = useState<number | null>(
    isCompactEmbedSlot(slot) ? compactDefaults.width : null
  );
  const minHeightNumber = parseMinHeight(minHeight);
  const minHeightCss = formatMinHeightCss(minHeight);
  const hasExplicitHeight = style?.height != null;
  const contextRef = useRef(context);

  /**
   * Keeps the latest context available for dom-ready pushes without remounting the webview.
   */
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  /**
   * Subscribes to guest content height reports before the webview is created so early
   * reports are not missed while the guest bootstrap completes.
   */
  useEffect(() => {
    if (resizeMode !== 'content') {
      return;
    }
    return window.api.onPluginSurfaceResize((message) => {
      if (
        message.pluginId !== pluginId ||
        message.contributionId !== contributionId ||
        message.kind !== kind ||
        (message.slot ?? 'content') !== slot
      ) {
        return;
      }
      if (message.height != null && slot === 'content') {
        setContentHeight(Math.max(message.height, minHeightNumber));
      }
      if (message.height != null && isCompactEmbedSlot(slot)) {
        setContentHeight(Math.max(message.height, compactDefaults.height));
      }
      if (message.width != null && isCompactEmbedSlot(slot)) {
        setContentWidth(Math.max(message.width, compactDefaults.width));
      }
    });
  }, [
    pluginId,
    contributionId,
    kind,
    slot,
    resizeMode,
    minHeightNumber,
    compactDefaults.height,
    compactDefaults.width
  ]);

  /**
   * Creates the surface webview imperatively so `src` is set before attach.
   *
   * React-rendered `<webview>` elements attach with an empty src first; the main
   * process `will-attach-webview` handler rejects that attach.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    setLoadError(null);
    const webview = document.createElement('webview') as Electron.WebviewTag;
    webview.partition = `persist:plugin-${pluginId}`;
    webview.setAttribute('allowpopups', 'false');
    webview.src = src;
    webview.className = className ?? '';

    if (resizeMode === 'fill') {
      applyFillWebviewStyles(webview);
    } else if (isCompactEmbedSlot(slot)) {
      Object.assign(webview.style, {
        display: 'inline-flex',
        width: `${compactDefaults.width}px`,
        height: `${compactDefaults.height}px`,
        border: 'none',
        background: 'transparent',
        overflow: 'hidden',
        ...(style as Record<string, string | undefined>)
      });
    } else {
      Object.assign(webview.style, {
        display: 'block',
        width: '100%',
        minHeight: minHeightCss,
        border: 'none',
        background: 'transparent',
        ...(style as Record<string, string | undefined>)
      });
    }

    webviewRef.current = webview;

    const pushContext = (): void => {
      void window.api.pushPluginViewContext({
        pluginId,
        contributionId,
        kind,
        context: contextRef.current ?? null
      });
    };

    const handleFailLoad = (event: Electron.DidFailLoadEvent): void => {
      if (!event.isMainFrame) {
        return;
      }
      setLoadError(event.errorDescription || 'Plugin surface failed to load.');
    };

    const handleDomReady = (): void => {
      pushContext();
    };

    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('did-fail-load', handleFailLoad);
    container.appendChild(webview);

    return () => {
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('did-fail-load', handleFailLoad);
      webview.remove();
      if (webviewRef.current === webview) {
        webviewRef.current = null;
      }
    };
  }, [
    pluginId,
    contributionId,
    kind,
    src,
    className,
    minHeightCss,
    style,
    resizeMode,
    slot,
    compactDefaults.height,
    compactDefaults.width
  ]);

  /**
   * Pushes updated context when props change without remounting the webview.
   */
  useEffect(() => {
    void window.api.pushPluginViewContext({
      pluginId,
      contributionId,
      kind,
      context: context ?? null
    });
  }, [pluginId, contributionId, kind, context]);

  /**
   * Applies reported content height or header-actions width to the container and webview.
   */
  useLayoutEffect(() => {
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }
    if (resizeMode === 'fill') {
      applyFillWebviewStyles(webview);
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    if (isCompactEmbedSlot(slot) && contentWidth != null) {
      const width = `${contentWidth}px`;
      const height = `${contentHeight ?? compactDefaults.height}px`;
      webview.style.width = width;
      webview.style.height = height;
      webview.style.overflow = 'hidden';
      container.style.width = width;
      container.style.height = height;
      container.style.display = 'inline-flex';
      container.style.overflow = 'hidden';
      return;
    }
    if (contentHeight != null) {
      const height = `${contentHeight}px`;
      webview.style.height = height;
      container.style.height = height;
    }
  }, [contentHeight, contentWidth, resizeMode, slot, compactDefaults.height]);

  if (loadError) {
    return (
      <p className="text-[14px] text-danger" role="alert">
        {loadError}
      </p>
    );
  }

  const containerStyle: CSSProperties =
    resizeMode === 'fill'
      ? {
          position: 'relative',
          width: '100%',
          ...(hasExplicitHeight ? { ...style } : { flex: '1 1 0%', minHeight: 0 })
        }
      : isCompactEmbedSlot(slot)
        ? {
            display: 'inline-flex',
            width: `${contentWidth ?? compactDefaults.width}px`,
            height: `${contentHeight ?? compactDefaults.height}px`,
            maxWidth: '100%',
            overflow: 'hidden',
            ...style
          }
        : {
            display: 'block',
            width: '100%',
            minHeight: minHeightCss,
            ...style
          };

  return <div ref={containerRef} className={className} style={containerStyle} />;
}

/**
 * Embeds one plugin UI contribution inside an isolated `<webview>` webContents.
 */
export function PluginSurface(props: Props): JSX.Element {
  const slot = props.slot ?? 'content';
  const src = buildPluginSurfaceUrl(props.pluginId, props.contributionId, props.kind, slot);

  return <PluginSurfaceInstance key={src} {...props} slot={slot} src={src} />;
}
