import { registerHooks } from 'node:module'

// Node's native TypeScript stripping does not resolve Vite's extensionless
// relative imports; this synchronous hook is for regression tests only.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const suffix = specifier.slice(2)
      const url = new URL('../src/' + suffix + (suffix.endsWith('.ts') ? '' : '.ts'), import.meta.url)
      return nextResolve(url.href, context)
    }
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (error?.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')
        && !/\.(?:ts|js|mjs|cjs|json)$/.test(specifier)) {
        return nextResolve(specifier + '.ts', context)
      }
      throw error
    }
  },
})
