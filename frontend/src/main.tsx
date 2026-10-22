import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { instalarTemporizadoresForaDaPagina } from './sala/temporizadores'
import { restaurarEnderecoMascarado } from './salas/mascara'
import './estilos/global.css'

// Antes de qualquer sala existir: o SDK lê `CriticalTimers` na hora de usar, e a troca vale
// para o app inteiro enquanto a aba viver.
instalarTemporizadoresForaDaPagina()
// A aba que recarregou com o endereço da Sala privada escondido volta ao verdadeiro.
restaurarEnderecoMascarado()

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('elemento #raiz não encontrado no index.html')

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
