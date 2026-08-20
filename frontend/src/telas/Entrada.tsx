import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { entrar, precheckarConvite } from '../api/convites'
import { mensagemDoErro } from '../api/cliente'
import { useSessao } from '../sessao/sessao'
import { Aviso } from '../ui/Aviso'
import { Botao } from '../ui/Botao'
import { Campo } from '../ui/Campo'
import estilos from './Entrada.module.css'

const LIMITE_DO_NOME = 40

/**
 * A porta. Pré-checa o convite antes de pedir o nome — descobrir que o link expirou depois de
 * digitar o nome é a versão ruim da mesma tela.
 *
 * A pré-checagem não consome uso do convite (contrato); quem consome é o `POST /api/entrar`.
 * Por isso, sessão válida guardada atravessa direto: abrir o mesmo link duas vezes, ou dar F5,
 * não pode custar um uso.
 */
export function Entrada() {
  const { token = '' } = useParams()
  const navegar = useNavigate()
  const { credenciais, guardar } = useSessao()

  const [nome, setNome] = useState('')
  const [erroAoEntrar, setErroAoEntrar] = useState<unknown>(null)
  const [enviando, setEnviando] = useState(false)

  const convite = useQuery({
    queryKey: ['convite', token],
    queryFn: () => precheckarConvite(token),
    retry: false,
    // Quem já tem sessão válida está só recarregando a página: nem a pré-checagem precisa sair.
    enabled: credenciais === null,
  })

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setErroAoEntrar(null)
    setEnviando(true)
    try {
      guardar(await entrar(token, nome.trim()))
      navegar('/sala', { replace: true })
    } catch (falha) {
      setErroAoEntrar(falha)
    } finally {
      setEnviando(false)
    }
  }

  if (credenciais) return <Navigate to="/sala" replace />

  return (
    <div className={estilos.tela}>
      <div className={estilos.caixa}>
        <div className={estilos.marca}>share</div>

        {convite.isPending && <p className={estilos.legenda}>Conferindo o convite…</p>}

        {convite.isError && (
          <div className={estilos.cartao}>
            <h1 className={estilos.titulo}>Convite recusado</h1>
            <Aviso tom="erro">{mensagemDoErro(convite.error)}</Aviso>
          </div>
        )}

        {convite.isSuccess && (
          <div className={estilos.cartao}>
            <div>
              <h1 className={estilos.titulo}>Entrar na sala</h1>
              <p className={estilos.legenda}>
                Convite <strong className={estilos.rotulo}>{convite.data.rotulo}</strong>
              </p>
            </div>

            {erroAoEntrar !== null && <Aviso tom="erro">{mensagemDoErro(erroAoEntrar)}</Aviso>}

            <form className={estilos.formulario} onSubmit={enviar} noValidate>
              <Campo
                rotulo="Seu nome"
                name="nome"
                autoComplete="nickname"
                autoFocus
                maxLength={LIMITE_DO_NOME}
                placeholder="como os outros vão te ver"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <Botao
                type="submit"
                aparencia="primario"
                blocoInteiro
                ocupado={enviando}
                disabled={nome.trim() === ''}
              >
                {enviando ? 'entrando…' : 'Entrar'}
              </Botao>
            </form>
          </div>
        )}

        <p className={estilos.rodape}>
          Microfone e câmera só ligam quando você mandar — a sala abre em silêncio.
        </p>
      </div>
    </div>
  )
}
