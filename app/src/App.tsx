import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { db, requestPersistentStorage } from './db/client'
import Home from './pages/Home'
import ItemDetail from './pages/ItemDetail'
import ItemForm from './pages/ItemForm'
import Settings from './pages/Settings'
import Wishlist from './pages/Wishlist'

// HashRouter : fonctionne sur GitHub Pages sans configuration de redirection.
export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        await db.seedIfEmpty()
        await requestPersistentStorage()
        setReady(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [])

  if (error) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="font-display text-lg">Impossible d'ouvrir la base</h1>
        <p className="text-sm text-muted">{error}</p>
      </main>
    )
  }
  if (!ready) {
    return <main className="flex h-dvh items-center justify-center text-sm text-muted">Chargement…</main>
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/reglages" element={<Settings />} />
        <Route path="/article/nouveau" element={<ItemForm />} />
        <Route path="/article/:id" element={<ItemDetail />} />
        <Route path="/article/:id/modifier" element={<ItemForm />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </HashRouter>
  )
}
