import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { gsap } from './lib/gsap'
import './index.css'
import App from './App.tsx'

gsap.config({ nullTargetWarn: false })
/* gsap.defaults() fusionne à vie dans _defaults ; d’anciennes options (force3D, autoRound)
 * y restent après un mauvais gsap.defaults() ou un HMR, puis se propagent aux tweens
 * (ex. delayedCall) → « Invalid property … Missing plugin ». On les retire explicitement. */
{
  const d = gsap.defaults() as Record<string, unknown>
  delete d.force3D
  delete d.autoRound
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
