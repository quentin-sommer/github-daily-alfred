export type Maybe<T> = T | undefined

export function errorIsFileNotExists(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith("ENOENT:")
}
