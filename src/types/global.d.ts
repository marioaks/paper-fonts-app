// Global type definitions for the Local Font Access API
declare global {
  interface Window {
    queryLocalFonts?: (postscriptNames?: string[]) => Promise<FontData[]>
  }

  interface FontData {
    postscriptName: string
    fullName: string
    family: string
    style: string
  }

  type FontFamiliesDictionary = Partial<Record<string, FontData[]>>
  type FavoriteFontFamiliesDictionary = Record<string, boolean>
}

export { }
