import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs"
import { resolve } from "path"
import { logger } from "./logger"

type CachedValue<T> = {
  maxAge: number
  value: T
}

export class Cache<T> {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true })
  }

  private getFilePath(key: string) {
    return resolve(this.dir, `${key}.json`)
  }

  get(key: string): { value: T; stale: boolean } | undefined {
    const filepath = this.getFilePath(key)
    logger().info("get", filepath)
    try {
      const content = readFileSync(filepath, { encoding: "utf-8" })
      const parsed = JSON.parse(content) as CachedValue<T>
      return {
        stale: parsed.maxAge < Date.now(),
        value: parsed.value,
      }
    } catch (err) {
      // File does not exist
      if (err instanceof Error && err.message.startsWith("ENOENT:")) {
        return undefined
      }

      logger().info(`Error while getting cached file ${filepath}: ${err}`)
      rmSync(filepath, { force: true })

      return undefined
    }
  }
  set(key: string, value: T, ttlMs: number): boolean {
    logger().info("set", this.getFilePath(key))
    try {
      const cachedValue: CachedValue<T> = {
        maxAge: Date.now() + ttlMs,
        value: value,
      }
      const content = JSON.stringify(cachedValue)
      writeFileSync(this.getFilePath(key), content)
      return true
    } catch (err) {
      logger().info(err)
      return false
    }
  }
}
