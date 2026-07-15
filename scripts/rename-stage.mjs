#!/usr/bin/env node
/**
 * Mechanical rename: Stage / role / ScriptStage → Stage / stage / ScriptStage.
 * Skips unrelated chat, team hub, and plugin menu role fields.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

const ROOT = '/media/sean/work/www/harborclient/harborclient';

const SKIP_FILES = new Set([
  'src/main/ai/completeChatTurn.ts',
  'src/renderer/src/ui/Sidebars/AiSidebar/Chat/MessageBubble.tsx',
  'src/renderer/src/store/thunks/aiChat.ts',
  'src/renderer/src/ui/Tabs/TeamHub/TeamManageView.tsx',
  'src/renderer/src/ui/Tabs/TeamHub/teamUserFormHelpers.ts',
  'src/main/plugins/pluginMenuMerge.ts',
  'src/main/plugins/pluginMenuMerge.test.ts',
  'src/main/plugins/PluginUiBroker.ts',
  'src/main/shortcutDispatch.ts'
]);

const REPLACEMENTS = [
  ['#/shared/scriptStage', '#/shared/scriptStage'],
  ['ScriptEditorGroup', 'ScriptEditorGroup'],
  ['SCRIPT_EDITOR_GROUP_HEADINGS', 'SCRIPT_EDITOR_GROUP_HEADINGS'],
  ['DEFAULT_SCRIPT_STAGE', 'DEFAULT_SCRIPT_STAGE'],
  ['SCRIPT_STAGE_OPTIONS', 'SCRIPT_STAGE_OPTIONS'],
  ['normalizeScriptStage', 'normalizeScriptStage'],
  ['scriptStageLabel', 'scriptStageLabel'],
  ['scriptStageGroup', 'scriptStageGroup'],
  ['orderScriptRefsByStage', 'orderScriptRefsByStage'],
  ['isScriptStageEditable', 'isScriptStageEditable'],
  ['AddScriptStageModal', 'AddScriptStageModal'],
  ['ChangeScriptStageModal', 'ChangeScriptStageModal'],
  ['addScriptStageModalOpen', 'addScriptStageModalOpen'],
  ['changeStageTarget', 'changeStageTarget'],
  ['handleStageChange', 'handleStageChange'],
  ['stageEditable', 'stageEditable'],
  ['onOpenChangeStage', 'onOpenChangeStage'],
  ['defaultStage', 'defaultStage'],
  ['ScriptStage', 'ScriptStage'],
  ["'stage'", "'stage'"],
  ['"stage"', '"stage"'],
  ["entry['stage']", 'entry.stage'],
  ["snippet['stage']", 'snippet.stage'],
  ['scriptStage.optional()', 'scriptStage.optional()'],
  ['scriptStage,', 'scriptStage,'],
  ['export const scriptStage', 'export const scriptStage'],
  ['import { scriptStage }', 'import { scriptStage }'],
  ['scriptStage }', 'scriptStage }'],
  ['migrateSqliteSnippetStageColumn', 'migrateSqliteSnippetStageColumn'],
  ['migrateSnippetStage', 'migrateSnippetStage'],
  ['ensureProviderSnippetStageColumn', 'ensureProviderSnippetStageColumn'],
  ['Change Stage', 'Change Stage'],
  ['Stage', 'Stage'],
  ['stage', 'stage'],
  ['Stage', 'Stage'],
  ['stage', 'stage'],
  ['Stage', 'Stage']
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = p.slice(ROOT.length + 1);
    if (rel.startsWith('node_modules') || rel.startsWith('dist') || rel.startsWith('.git')) {
      continue;
    }
    const st = statSync(p);
    if (st.isDirectory()) {
      walk(p, out);
    } else if (/\.(ts|tsx|md|json|mjs|vue)$/.test(name) && !rel.includes('scriptRole.ts')) {
      out.push(p);
    }
  }
  return out;
}

const SNIPPET_ROLE_PATTERNS = [
  [/\brole\?: ScriptStage/g, 'stage?: ScriptStage'],
  [/\brole: ScriptStage/g, 'stage: ScriptStage'],
  [/\brole = DEFAULT_SCRIPT_STAGE/g, 'stage = DEFAULT_SCRIPT_STAGE'],
  [/\binput\.role\b/g, 'input.stage'],
  [/\bdraft\.role\b/g, 'draft.stage'],
  [/\bref\.role\b/g, 'ref.stage'],
  [/\bscript\.role\b/g, 'script.stage'],
  [/\bsnippet\.role\b/g, 'snippet.stage'],
  [/\bdata\.role\b/g, 'data.stage'],
  [/\bpayload\.role\b/g, 'payload.stage'],
  [/\brecord\.role\b/g, 'record.role'], // keep for legacy shim line only - fix manually
  [/\brow\.role\b/g, 'row.stage'],
  [/\bcreated\.role\b/g, 'created.stage'],
  [/\bupdated\.role\b/g, 'updated.stage'],
  [/\bexportData\.role\b/g, 'exportData.stage'],
  [/\bnormalizeScriptStage\(role\)/g, 'normalizeScriptStage(stage)'],
  [/\bnormalizeScriptStage\(input\.stage\)/g, 'normalizeScriptStage(input.stage)'],
  [/, stage,/g, ', stage,'],
  [/, role\)/g, ', stage)'],
  [/\(stage,/g, '(stage,'],
  [/\brole\?:/g, 'stage?:'],
  [/\brole,/g, 'stage,'],
  [/\brole\)/g, 'stage)'],
  [/\brole TEXT/g, 'stage TEXT'],
  [/\brole VARCHAR/g, 'stage VARCHAR'],
  [/, stage, /g, ', stage, '],
  [/'stage'/g, "'stage'"],
  [/"stage"/g, '"stage"'],
  [/\brole: scriptStage/g, 'stage: scriptStage'],
  [/\brole: scriptStage\.optional\(\)/g, 'stage: scriptStage.optional()'],
  [/\brole: z\./g, 'stage: z.'],
  [/\?\.role\b/g, '?.stage'],
  [/\(role\)/g, '(stage)'],
  [/\(stage /g, '(stage '],
  [/@param stage\b/g, '@param stage'],
  [/\bconst role =/g, 'const stage ='],
  [/\bsetRole\b/g, 'setStage'],
  [/\broleSelectId\b/g, 'stageSelectId'],
  [/\bconst \[stage,/g, 'const [stage,'],
  [/\brole, setStage/g, 'stage, setStage'],
  [/\bnormalizeScriptStage\(stage\)/g, 'normalizeScriptStage(stage)'],
  [/\bnormalizeScriptStage\(ref\.stage\)/g, 'normalizeScriptStage(readScriptRefStage(ref))'],
  [/\bnormalizeScriptStage\(script\.stage\)/g, 'normalizeScriptStage(readScriptRefStage(script))'],
  [/\bnormalizeScriptStage\(created\.stage\)/g, 'normalizeScriptStage(created.stage)'],
  [/\bnormalizeScriptStage\(clone\.stage\)/g, 'normalizeScriptStage(clone.stage)'],
  [/\bnormalizeScriptStage\(activeScript\.stage\)/g, 'normalizeScriptStage(activeScript.stage)'],
  [/\bnormalizeScriptStage\(overScript\.stage\)/g, 'normalizeScriptStage(overScript.stage)'],
  [/\bnormalizeScriptStage\(saveSnippetScript\.stage\)/g, 'normalizeScriptStage(saveSnippetScript.stage)'],
  [/\bnormalizeScriptStage\(changeStageTarget\.stage\)/g, 'normalizeScriptStage(changeStageTarget.stage)'],
  [/\bstage: normalizeScriptStage\(readScriptRefStage\(ref\)\)/g, 'stage: normalizeScriptStage(readScriptRefStage(ref))'],
];

let changed = 0;
for (const file of walk(ROOT)) {
  const rel = file.slice(ROOT.length + 1);
  if (SKIP_FILES.has(rel)) {
    continue;
  }
  if (rel === 'src/shared/scriptRole.test.ts') {
    continue;
  }
  let text = readFileSync(file, 'utf8');
  const before = text;
  for (const [from, to] of REPLACEMENTS) {
    text = text.split(from).join(to);
  }
  if (
    rel.includes('snippet') ||
    rel.includes('Script') ||
    rel.includes('script') ||
    rel.includes('storage') ||
    rel.includes('manifest') ||
    rel.includes('catalog') ||
    rel.includes('ipc') ||
    rel.includes('preload') ||
    rel.includes('thunks/snippets') ||
    rel.includes('entityMappers') ||
    rel.includes('providerSnippet') ||
    rel.includes('seedDefault') ||
    rel.includes('SnippetMover') ||
    rel.includes('snippetData') ||
    rel.includes('scriptRef') ||
    rel.includes('scriptRefs') ||
    rel.includes('istorageContract') ||
    rel.includes('DatabaseMigrator') ||
    rel.includes('teamHub') && rel.includes('Snippet') ||
    rel.includes('TeamSnippets') ||
    rel.includes('InstalledView') ||
    rel.includes('SnippetEdit') ||
    rel.includes('SnippetDetail') ||
    rel.includes('helpers.test') ||
    rel.includes('unified.test') ||
    rel.includes('snippetEditDraft') ||
    rel.includes('scriptResolution') ||
    rel.includes('ROADMAP') ||
    rel.includes('resources/docsSearchIndex')
  ) {
    for (const [re, rep] of SNIPPET_ROLE_PATTERNS) {
      text = text.replace(re, rep);
    }
  }
  if (text !== before) {
    writeFileSync(file, text);
    changed++;
  }
}

try {
  unlinkSync(join(ROOT, 'src/shared/scriptRole.ts'));
} catch {
  /* already removed */
}
try {
  unlinkSync(join(ROOT, 'src/shared/scriptRole.test.ts'));
} catch {
  /* already removed */
}

console.log(`Updated ${changed} files`);
