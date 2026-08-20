import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './estilos/global.css'

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('elemento #raiz não encontrado no index.html')

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
