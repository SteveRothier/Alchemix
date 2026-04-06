import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { gsap } from './lib/gsap'
import './index.css'
import App from './App.tsx'

gsap.config({ nullTargetWarn: false })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
