import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('pwa:update-available', { detail: updateSW }))
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
