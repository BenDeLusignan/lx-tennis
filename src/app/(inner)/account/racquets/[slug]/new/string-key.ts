/**
 * A string's brand and name as one comparable key: each string option
 * carries it (`data-key` in string-picker.tsx), and SetupFormConstraints
 * builds one from what's typed for a new string to find a match.
 * Lowercased, like the database's unique index. The newline between them
 * can't be typed into a one-line field, so "a b" + "c" and "a" + "b c" stay
 * different. (Not NUL: the HTML parser turns a NUL in an attribute into
 * U+FFFD, so the server-rendered keys would never match.)
 *
 * Its own file, with no "use client", so the server-rendered picker and the
 * client-side check can both call it.
 */
export function stringKey(brand: string, name: string): string {
  return `${brand.trim()}\n${name.trim()}`.toLowerCase();
}
