import { useLayoutEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AlchemixShell } from './components/layout/AlchemixShell'
import { LAB_MESSAGES } from './components/lab/labMessages'
import { RecipeManagerPage } from './pages/RecipeManagerPage'

function RecipeManagerDevRoute() {
  const navigate = useNavigate()
  const isDev = import.meta.env.DEV

  useLayoutEffect(() => {
    if (isDev) return
    window.alert(LAB_MESSAGES.canvas.workshopDevOnlyAlert)
    navigate('/', { replace: true })
  }, [isDev, navigate])

  if (!isDev) return null
  return <RecipeManagerPage />
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AlchemixShell />} />
        <Route path="/recipes" element={<RecipeManagerDevRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
