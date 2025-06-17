/**
 * Converts an array of strings into a Record<string, number> where each string
 * is mapped to its index in the array.
 *
 * @param arr - Array of strings to convert
 * @returns Record<string, number> mapping each string to its index
 */
export function arrayToIndexLookup(arr: string[]): Record<string, number> {
  return arr.reduce((acc, curr, index) => {
    acc[curr] = index
    return acc
  }, {} as Record<string, number>)
}

/**
   * Sorts an array of strings based on an index lookup.
   *
   * @param arr - Array of strings to sort
   * @param indexLookup - Record<string, number> mapping each string to its index
   * @returns Sorted array of strings
   */
export const sortArrayByIndexLookup = (arr: string[], indexLookup: Record<string, number>) => {
  return arr.sort((a, b) => {
    const orderA = indexLookup[a] ?? Infinity
    const orderB = indexLookup[b] ?? Infinity

    if (orderA === orderB) {
      return a.localeCompare(b)
    }

    return orderA - orderB
  })
}
