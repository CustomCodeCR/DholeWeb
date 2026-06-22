export function toCapitalized(str: string): string {
  const words = str.split(' ')
  const stitched = []
  for (const word of words) {
    if (!word) continue
    stitched.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
  }
  return stitched.join(' ')
}

export function camelCaseToSpaces(input: string): string {
  return input.replace(/([a-z])([A-Z])/g, '$1 $2')
}
