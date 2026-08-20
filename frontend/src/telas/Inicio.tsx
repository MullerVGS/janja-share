import { Navigate } from 'react-router-dom'
import { useSessao } from '../sessao/sessao'
import estilos from './Entrada.module.css'

/** A raiz não tem porta própria: ou já há sessão, ou o caminho é um convite. */
export function Inicio() {
  const { credenciais } = useSessao()
  if (credenciais) return <Navigate to="/sala" replace />

  return (
    <div className={estilos.tela}>
      <div className={estilos.caixa}>
        <div className={estilos.marca}>share</div>
        <div className={estilos.cartao}>
          <h1 className={estilos.titulo}>Você precisa de um convite</h1>
          <p className={estilos.legenda}>
            Esta sala não tem cadastro nem senha. O acesso é um link de convite, no formato
            <code className={estilos.rotulo}> /c/…</code> — peça um a quem administra a sala.
          </p>
          <p className={estilos.legenda}>
            Recarregar a página não derruba quem já entrou — a sessão volta sozinha. Ela se perde ao
            fechar a aba, ou quando o passe da sala vence; aí é abrir o convite de novo.
          </p>
        </div>
      </div>
    </div>
  )
}
