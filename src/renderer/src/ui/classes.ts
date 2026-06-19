/** Shared macOS-style Tailwind class strings. */

export const field =
  'rounded-md border border-separator bg-control px-2 py-1 text-[15px] text-text shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)] app-no-drag'

export const primaryButton =
  'cursor-pointer rounded-md border border-transparent bg-accent px-3 py-1 text-[15px] font-medium text-white shadow-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 app-no-drag'

export const secondaryButton =
  'cursor-pointer rounded-md border border-separator bg-control px-3 py-1 text-[15px] text-text shadow-sm hover:bg-selection disabled:cursor-not-allowed disabled:opacity-50 app-no-drag'

export const toolbarButton =
  'cursor-pointer rounded-md border-none bg-transparent px-2 py-1 text-[15px] text-accent hover:bg-selection app-no-drag'

export const iconButton =
  'inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-selection hover:text-text app-no-drag'

export const iconButtonDanger =
  'inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-danger/15 hover:text-danger app-no-drag'

export const segmentGroup =
  'inline-flex rounded-md bg-control p-0.5 shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)] app-no-drag'

export function segment(active: boolean): string {
  return active
    ? 'cursor-pointer rounded-[5px] border-none bg-surface px-3 py-1 text-[15px] text-text shadow-sm app-no-drag'
    : 'cursor-pointer rounded-[5px] border-none bg-transparent px-3 py-1 text-[15px] text-muted hover:text-text app-no-drag'
}

export function sourceRow(selected: boolean): string {
  return selected
    ? 'group flex items-center gap-1 rounded-md bg-selection px-1.5 py-0.5 app-no-drag'
    : 'group flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-selection/60 app-no-drag'
}

export const separator = 'h-px bg-separator'

export const sectionLabel =
  'mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted'

export const METHOD_CLASSES: Record<string, string> = {
  get: 'bg-method-get/90 text-white',
  post: 'bg-method-post/90 text-white',
  put: 'bg-method-put/90 text-white',
  patch: 'bg-method-patch/90 text-white',
  delete: 'bg-method-delete/90 text-white',
  head: 'bg-method-head/80 text-white',
  options: 'bg-method-options/80 text-white'
}

export function statusDotClass(status: number): string {
  if (status === 0) return 'bg-danger'
  if (status >= 200 && status < 300) return 'bg-success'
  if (status >= 300 && status < 400) return 'bg-warning'
  if (status >= 400) return 'bg-danger'
  return 'bg-info'
}
