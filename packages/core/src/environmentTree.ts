import type { Environment, Variable } from './types';
import { mergeEnvironmentVariables } from './environmentVariables';

/**
 * Maximum parent-chain depth before inheritance resolution aborts.
 */
export const MAX_ENVIRONMENT_INHERITANCE_DEPTH = 32;

/**
 * An environment plus its nested child environments for sidebar trees.
 */
export interface EnvironmentTreeNode {
  /**
   * Environment row at this tree node.
   */
  environment: Environment;

  /**
   * Immediate child environments, ordered by sidebar sort then name.
   */
  children: EnvironmentTreeNode[];
}

/**
 * Builds a nested environment tree from a flat environment list using parentUuid.
 *
 * Orphaned environments whose parent is missing from the list are treated as roots
 * so the tree remains usable after partial loads or import gaps. Sibling order
 * follows the input list order (storage `sort_order`).
 *
 * @param environments - Flat environments from storage (already sort-ordered).
 * @returns Root-level tree nodes (parentUuid null or missing parent).
 */
export function buildEnvironmentTree(environments: readonly Environment[]): EnvironmentTreeNode[] {
  const byUuid = new Map<string, EnvironmentTreeNode>();
  for (const environment of environments) {
    byUuid.set(environment.uuid, { environment, children: [] });
  }

  const roots: EnvironmentTreeNode[] = [];
  for (const environment of environments) {
    const node = byUuid.get(environment.uuid);
    if (!node) {
      continue;
    }
    const parentUuid = environment.parentUuid?.trim() || null;
    if (parentUuid && byUuid.has(parentUuid) && parentUuid !== environment.uuid) {
      byUuid.get(parentUuid)?.children.push(node);
      continue;
    }
    roots.push(node);
  }

  return roots;
}

/**
 * Flattens an environment tree to a preorder list (parent before descendants).
 *
 * @param nodes - Root tree nodes.
 * @returns Environments in display preorder.
 */
export function flattenEnvironmentTree(nodes: readonly EnvironmentTreeNode[]): Environment[] {
  const result: Environment[] = [];

  /**
   * Walks one subtree in preorder.
   *
   * @param node - Node to visit.
   */
  function visit(node: EnvironmentTreeNode): void {
    result.push(node.environment);
    for (const child of node.children) {
      visit(child);
    }
  }

  for (const node of nodes) {
    visit(node);
  }
  return result;
}

/**
 * Returns descendant uuids of an environment (not including itself).
 *
 * @param rootUuid - Environment whose descendants are collected.
 * @param environments - Flat environment list.
 * @returns Set of descendant uuids.
 */
export function collectEnvironmentDescendantUuids(
  rootUuid: string,
  environments: readonly Environment[]
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const environment of environments) {
    const parentUuid = environment.parentUuid?.trim();
    if (!parentUuid) {
      continue;
    }
    const list = childrenByParent.get(parentUuid) ?? [];
    list.push(environment.uuid);
    childrenByParent.set(parentUuid, list);
  }

  const descendants = new Set<string>();
  const stack = [...(childrenByParent.get(rootUuid) ?? [])];
  while (stack.length > 0) {
    const uuid = stack.pop();
    if (!uuid || descendants.has(uuid)) {
      continue;
    }
    descendants.add(uuid);
    const children = childrenByParent.get(uuid);
    if (children) {
      stack.push(...children);
    }
  }
  return descendants;
}

/**
 * Walks from an active environment up through parentUuid links to the root.
 *
 * @param active - Environment currently selected for requests.
 * @param environments - Flat environment list used to resolve parents.
 * @returns Environments ordered root → leaf (active last). Empty when active is missing.
 * @throws When a cycle is detected or the chain exceeds {@link MAX_ENVIRONMENT_INHERITANCE_DEPTH}.
 */
export function resolveEnvironmentChain(
  active: Environment,
  environments: readonly Environment[]
): Environment[] {
  const byUuid = new Map(environments.map((environment) => [environment.uuid, environment]));
  const leafToRoot: Environment[] = [];
  const seen = new Set<string>();
  let current: Environment | undefined = active;

  while (current) {
    if (seen.has(current.uuid)) {
      throw new Error(`Environment inheritance cycle detected at "${current.name}"`);
    }
    if (leafToRoot.length >= MAX_ENVIRONMENT_INHERITANCE_DEPTH) {
      throw new Error(
        `Environment inheritance exceeds ${MAX_ENVIRONMENT_INHERITANCE_DEPTH} levels`
      );
    }
    seen.add(current.uuid);
    leafToRoot.push(current);
    const parentUuid = current.parentUuid?.trim() || null;
    if (!parentUuid) {
      break;
    }
    current = byUuid.get(parentUuid);
  }

  return leafToRoot.reverse();
}

/**
 * Filters a variable list to rows that participate in runtime resolution.
 *
 * @param variables - Variable rows from one environment.
 * @returns Enabled rows with non-empty keys.
 */
export function enabledEnvironmentVariables(variables: readonly Variable[]): Variable[] {
  return variables.filter((variable) => variable.enabled !== false && variable.key.trim() !== '');
}

/**
 * Merges an inheritance chain root→leaf; later environments override earlier keys.
 *
 * Disabled rows on a child do not override parent values for that key.
 *
 * @param chain - Environments ordered root → leaf.
 * @returns Effective variable list for the leaf environment.
 */
export function mergeEnvironmentChain(chain: readonly Environment[]): Variable[] {
  let merged: Variable[] = [];
  for (const environment of chain) {
    merged = mergeEnvironmentVariables(merged, enabledEnvironmentVariables(environment.variables));
  }
  return merged;
}

/**
 * Resolves the effective variables for an active environment including ancestors.
 *
 * @param active - Environment currently selected for requests.
 * @param environments - Flat environment list used to resolve parents.
 * @returns Merged variables for request substitution.
 */
export function resolveInheritedEnvironmentVariables(
  active: Environment,
  environments: readonly Environment[]
): Variable[] {
  return mergeEnvironmentChain(resolveEnvironmentChain(active, environments));
}

/**
 * Returns whether assigning parentUuid to environmentUuid would create a cycle.
 *
 * @param environmentUuid - Environment that would gain the parent.
 * @param parentUuid - Proposed parent uuid, or null/empty for no parent.
 * @param environments - Flat environment list.
 * @returns True when the assignment is invalid.
 */
export function wouldCreateEnvironmentInheritanceCycle(
  environmentUuid: string,
  parentUuid: string | null | undefined,
  environments: readonly Environment[]
): boolean {
  const trimmedParent = parentUuid?.trim() || null;
  if (!trimmedParent) {
    return false;
  }
  if (trimmedParent === environmentUuid) {
    return true;
  }
  return collectEnvironmentDescendantUuids(environmentUuid, environments).has(trimmedParent);
}

/**
 * Builds Inherit-from select options that cannot create a cycle.
 *
 * @param environment - Environment being edited.
 * @param environments - All environments.
 * @returns Environments that are safe to select as parent (excludes self and descendants).
 */
export function listValidEnvironmentParents(
  environment: Environment,
  environments: readonly Environment[]
): Environment[] {
  const forbidden = collectEnvironmentDescendantUuids(environment.uuid, environments);
  forbidden.add(environment.uuid);
  return environments
    .filter((candidate) => !forbidden.has(candidate.uuid))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Builds a breadcrumb of environment names from root to the given environment.
 *
 * @param environment - Leaf environment.
 * @param environments - Flat environment list.
 * @returns Names ordered root → leaf.
 */
export function environmentInheritanceBreadcrumb(
  environment: Environment,
  environments: readonly Environment[]
): string[] {
  try {
    return resolveEnvironmentChain(environment, environments).map((entry) => entry.name);
  } catch {
    return [environment.name];
  }
}

/**
 * Describes an inherited variable row shown in environment settings.
 */
export interface InheritedEnvironmentVariable {
  /**
   * Variable key.
   */
  key: string;

  /**
   * Effective value (value or defaultValue) from the source environment.
   */
  value: string;

  /**
   * Display name of the ancestor environment that contributed the key.
   */
  sourceName: string;

  /**
   * Uuid of the ancestor environment that contributed the key.
   */
  sourceUuid: string;
}

/**
 * Lists variables inherited from ancestors (excluding the leaf's own enabled keys).
 *
 * @param environment - Leaf environment being edited.
 * @param environments - Flat environment list.
 * @returns Inherited keys with provenance; excludes keys the leaf already defines enabled.
 */
export function listInheritedEnvironmentVariables(
  environment: Environment,
  environments: readonly Environment[]
): InheritedEnvironmentVariable[] {
  let chain: Environment[];
  try {
    chain = resolveEnvironmentChain(environment, environments);
  } catch {
    return [];
  }

  if (chain.length <= 1) {
    return [];
  }

  const ancestors = chain.slice(0, -1);
  const leafEnabledKeys = new Set(
    enabledEnvironmentVariables(environment.variables).map((variable) => variable.key.trim())
  );

  const byKey = new Map<string, InheritedEnvironmentVariable>();
  for (const ancestor of ancestors) {
    for (const variable of enabledEnvironmentVariables(ancestor.variables)) {
      const key = variable.key.trim();
      byKey.set(key, {
        key,
        value: variable.value !== '' ? variable.value : variable.defaultValue,
        sourceName: ancestor.name,
        sourceUuid: ancestor.uuid
      });
    }
  }

  return [...byKey.values()]
    .filter((entry) => !leafEnabledKeys.has(entry.key))
    .sort((left, right) => left.key.localeCompare(right.key));
}

/**
 * Returns the next sibling environment under the same parent in storage/list order.
 *
 * @param environmentId - Environment whose next sibling is requested.
 * @param environments - Flat environments already ordered by sort_order.
 * @returns Next sibling, or undefined when this is the last sibling.
 */
export function findNextSiblingEnvironment(
  environmentId: number,
  environments: readonly Environment[]
): Environment | undefined {
  const environment = environments.find((entry) => entry.id === environmentId);
  if (!environment) {
    return undefined;
  }
  const parentKey = environment.parentUuid?.trim() || null;
  const siblings = environments.filter((entry) => (entry.parentUuid?.trim() || null) === parentKey);
  const index = siblings.findIndex((entry) => entry.id === environmentId);
  if (index < 0 || index >= siblings.length - 1) {
    return undefined;
  }
  return siblings[index + 1];
}

/**
 * Collects environment ids for a node and all descendants in preorder.
 *
 * @param node - Tree node to flatten.
 * @returns Ids in preorder.
 */
export function collectEnvironmentSubtreeIds(node: EnvironmentTreeNode): number[] {
  return [node.environment.id, ...node.children.flatMap(collectEnvironmentSubtreeIds)];
}

/**
 * Reorders sibling nodes and returns a full preorder id list for the updated tree.
 *
 * @param roots - Current environment tree.
 * @param parentUuid - Parent uuid of the sibling group (`null` for roots).
 * @param orderedSiblingIds - Desired sibling id order for that group.
 * @returns Full environment ids in sidebar preorder after the sibling reorder.
 */
export function reorderEnvironmentSiblingIds(
  roots: EnvironmentTreeNode[],
  parentUuid: string | null,
  orderedSiblingIds: number[]
): number[] {
  const parentKey = parentUuid?.trim() || null;

  /**
   * Applies sibling reorder at the matching parent level.
   *
   * @param nodes - Sibling nodes at the current level.
   * @param currentParentUuid - Parent uuid for these nodes.
   * @returns Updated sibling nodes.
   */
  function apply(
    nodes: EnvironmentTreeNode[],
    currentParentUuid: string | null
  ): EnvironmentTreeNode[] {
    const mappedChildren = nodes.map((node) => ({
      ...node,
      children: apply(node.children, node.environment.uuid)
    }));

    if ((currentParentUuid?.trim() || null) !== parentKey) {
      return mappedChildren;
    }

    const byId = new Map(mappedChildren.map((node) => [node.environment.id, node]));
    const reordered: EnvironmentTreeNode[] = [];
    for (const id of orderedSiblingIds) {
      const node = byId.get(id);
      if (node) {
        reordered.push(node);
        byId.delete(id);
      }
    }
    for (const node of byId.values()) {
      reordered.push(node);
    }
    return reordered;
  }

  const nextRoots = apply(roots, null);
  return flattenEnvironmentTree(nextRoots).map((environment) => environment.id);
}
