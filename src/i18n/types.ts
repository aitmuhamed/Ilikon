import type mn from './dictionaries/mn'

/**
 * Widens the reference dictionary's literal string types so the other
 * languages are checked for *shape* (every key present, no extras) without
 * being forced to repeat the Mongolian strings.
 */
type Widen<T> = {
  [K in keyof T]: T[K] extends string ? string : Widen<T[K]>
}

export type Dictionary = Widen<typeof mn>
export type DictionarySection = keyof Dictionary
