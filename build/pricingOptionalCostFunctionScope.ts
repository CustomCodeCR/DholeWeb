// Scope replacement to a single top-level helper. Older Vite transforms matched
// through selectableOptionalLines and silently removed unrelated Incoterm functions.
const FUNCTION_PATTERN = /function shouldIncludeOptionalCost\([\s\S]*?\n\}/g

export function replaceScopedOptionalCostFunction(
  source: string,
  replacement: string,
  pluginName: string,
): string {
  const matches = [...source.matchAll(FUNCTION_PATTERN)]
  if (matches.length !== 1 || matches[0].index === undefined) {
    throw new Error('[' + pluginName + '] Expected one shouldIncludeOptionalCost function; found ' + matches.length)
  }
  const match = matches[0]
  return source.slice(0, match.index)
    + replacement
    + source.slice(match.index + match[0].length)
}
