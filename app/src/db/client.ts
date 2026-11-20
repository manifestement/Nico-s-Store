import type { Request, Response, WorkerApi } from './api'

type Async<T> = { [K in keyof T]: T[K] extends (...a: infer A) => infer R ? (...a: A) => Promise<Awaited<R>> : never }

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
let nextId = 1

worker.onmessage = (event: MessageEvent<Response>) => {
  const msg = event.data
  const p = pending.get(msg.id)
  if (!p) return
  pending.delete(msg.id)
  if (msg.ok) p.resolve(msg.result)
  else p.reject(new Error(msg.error))
}

/** Client de la base : `await db.listPairs('owned')`, etc. Tout s'exécute dans le worker. */
export const db = new Proxy({} as Async<WorkerApi>, {
  get: (_, method: string) =>
    (...args: unknown[]) =>
      new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { resolve, reject })
        const request: Request = { id, method: method as Request['method'], args }
        worker.postMessage(request)
      }),
})

/** Demande au navigateur de ne pas effacer les données du site (important sur iOS). */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  return (await navigator.storage.persisted()) || navigator.storage.persist()
}
