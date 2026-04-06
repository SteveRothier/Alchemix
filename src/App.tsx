import { AppLayout } from './components/layout/AppLayout'
import { DndProvider } from './providers/DndProvider'

function App() {
  return (
    <DndProvider>
      <AppLayout />
    </DndProvider>
  )
}

export default App
