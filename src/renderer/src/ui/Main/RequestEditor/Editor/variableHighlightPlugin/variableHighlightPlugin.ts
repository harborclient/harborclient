import { addActivePlugin$, addComposerChild$, Cell, realmPlugin } from '@mdxeditor/editor';
import type { Variable } from '#/shared/types';

import { VariableHighlightComposer } from './VariableHighlightComposer';

/**
 * Collection variables used by the variable highlight composer.
 */
export const highlightVariables$ = Cell<Variable[]>([]);

/**
 * Optional callback that opens collection settings to edit variables.
 */
export const highlightOnEditVariable$ = Cell<(() => void) | undefined>(undefined);

interface VariableHighlightPluginParams {
  /**
   * Collection-scoped variables for highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit the hovered variable.
   */
  onEditVariable?: () => void;
}

/**
 * MDXEditor plugin that highlights {{variable}} tokens in rich-text comments.
 */
export const variableHighlightPlugin = realmPlugin<VariableHighlightPluginParams>({
  init(realm) {
    realm.pubIn({
      [addActivePlugin$]: 'variableHighlight',
      [addComposerChild$]: VariableHighlightComposer
    });
  },
  update(realm, params) {
    realm.pub(highlightVariables$, params?.variables ?? []);
    realm.pub(highlightOnEditVariable$, params?.onEditVariable);
  }
});
