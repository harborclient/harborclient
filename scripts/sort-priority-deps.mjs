import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJsonPath = path.join(projectRoot, 'package.json')

/**
 * HarborClient workspace packages that must appear first in `dependencies`,
 * in this order, so they stay visible above the long alphabetical tail.
 */
const PRIORITY_DEPENDENCIES = [
  '@harborclient/http',
  '@harborclient/sdk',
  '@harborclient/team-hub-api'
]

const mode = process.argv[2] === '--write' ? 'write' : 'check'

const raw = fs.readFileSync(packageJsonPath, 'utf8')
const pkg = JSON.parse(raw)

/**
 * Returns dependency keys with priority packages moved to the front.
 *
 * @param {Record<string, string>} dependencies
 * @returns {string[]}
 */
function orderedDependencyKeys(dependencies) {
  const keys = Object.keys(dependencies)
  const priority = PRIORITY_DEPENDENCIES.filter((name) => name in dependencies)
  const rest = keys.filter((name) => !priority.includes(name))
  return [...priority, ...rest]
}

/**
 * Builds a dependencies object with priority keys first and the rest unchanged.
 *
 * @param {Record<string, string>} dependencies
 * @returns {Record<string, string>}
 */
function reorderDependencies(dependencies) {
  const reordered = {}
  for (const name of orderedDependencyKeys(dependencies)) {
    reordered[name] = dependencies[name]
  }
  return reordered
}

/**
 * Returns true when every present priority dependency is at the top in order.
 *
 * @param {Record<string, string>} dependencies
 * @returns {boolean}
 */
function hasPriorityOrder(dependencies) {
  const expected = orderedDependencyKeys(dependencies)
  return Object.keys(dependencies).every((name, index) => name === expected[index])
}

if (!hasPriorityOrder(pkg.dependencies)) {
  if (mode === 'check') {
    console.error(
      'package.json: move HarborClient workspace deps to the top of dependencies:\n' +
        `  ${PRIORITY_DEPENDENCIES.join('\n  ')}\n\n` +
        'Run: pnpm format'
    )
    process.exit(1)
  }

  pkg.dependencies = reorderDependencies(pkg.dependencies)
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
  console.log('Reordered priority dependencies in package.json')
}
