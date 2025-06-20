// Global type definitions for the Local Font Access API
declare global {
  interface Window {
    queryLocalFonts?: (postscriptNames?: string[]) => Promise<Font[]>
  }

  type Font = {
    postscriptName: string
    fullName: string
    style: string
    family: string
  }

  interface FontFamily {
    id: string
    fullName: string
    styles: APIFont[]
  }

  type FontFamiliesDictionary = Record<string, FontFamily>
}

export { }
