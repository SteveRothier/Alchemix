import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AlchemixShell } from './components/layout/AlchemixShell'
import { RecipeManagerPage } from './pages/RecipeManagerPage'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AlchemixShell />} />
        <Route path="/recipes" element={<RecipeManagerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
