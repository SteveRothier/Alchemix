import { useLayoutEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AlchemixShell } from './components/layout/AlchemixShell'
import { LabWorkshopBlockedModalHost } from './components/lab/LabWorkshopBlockedModalHost'
import { RecipeManagerPage } from './pages/RecipeManagerPage'
import { requestWorkshopBlockedModal } from './lib/workshopBlockedModal'

function RecipeManagerDevRoute() {
  const navigate = useNavigate()
  const isDev = import.meta.env.DEV

  useLayoutEffect(() => {
    if (isDev) return
    requestWorkshopBlockedModal()
    navigate('/', { replace: true })
  }, [isDev, navigate])

  if (!isDev) return null
  return <RecipeManagerPage />
}

function App() {
  return (
    <HashRouter>
      <LabWorkshopBlockedModalHost />
      <Routes>
        <Route path="/" element={<AlchemixShell />} />
        <Route path="/recipes" element={<RecipeManagerDevRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
