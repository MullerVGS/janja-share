import { useEffect, useState, type FormEvent } from 'react'
import { mensagemDoErro } from '../../api/cliente'
import { ajustarSala, LIMITE_DO_NOME, type SalaAjustada } from '../../api/salas'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Dialogo } from '../../ui/Dialogo'
import estilos from './DialogoAjustarSala.module.css'

interface Props {
  aberto: boolean
  /** O que a Sala é agora. */
  link: SalaAjustada
  /** O token do LiveKit desta encarnação: é ele que prova ao servidor que a pessoa está dentro. */
  token: string
  aoAjustar(novo: SalaAjustada): void
  aoFechar(): void
}

/**
 * Nome e visibilidade depois de criar. A Sala não tem dono: qualquer pessoa dentro dela muda, e
 * todos recebem o resultado — inclusive o link novo, quando o slug muda junto.
 */
export function DialogoAjustarSala({ aberto, link, token, aoAjustar, aoFechar }: Props) {
  const [nome, setNome] = useState(link.nomeDaSala)
  const [privada, setPrivada] = useState(link.privada)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<unknown>(null)

  // Reabrir parte do que a Sala é agora — inclusive se alguém mudou enquanto o diálogo dormia.
  useEffect(() => {
    if (!aberto) return
    setNome(link.nomeDaSala)
    setPrivada(link.privada)
    setErro(null)
  }, [aberto])

  const nomeLimpo = nome.trim()
  // Toda mudança aqui pode trocar o slug: o nome vira endereço, e pública ↔ privada troca o sufixo.
  const mudou = nomeLimpo !== link.nomeDaSala || privada !== link.privada

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!mudou || nomeLimpo === '') return
    setEnviando(true)
    setErro(null)
    try {
      const ajuste: { nome?: string; privada?: boolean } = {}
      if (nomeLimpo !== link.nomeDaSala) ajuste.nome = nomeLimpo
      if (privada !== link.privada) ajuste.privada = privada
      aoAjustar(await ajustarSala(link.slug, ajuste, token))
    } catch (falha) {
      setErro(falha)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialogo aberto={aberto} titulo="Ajustar sala" aoFechar={aoFechar}>
      <form className={estilos.formulario} onSubmit={enviar} noValidate>
        {erro !== null && <Aviso tom="erro">{mensagemDoErro(erro)}</Aviso>}
        <Campo
          rotulo="Nome da sala"
          autoFocus
          maxLength={LIMITE_DO_NOME}
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
        />
        <label className={estilos.opcao}>
          <input type="checkbox" checked={privada} onChange={(evento) => setPrivada(evento.target.checked)} />
          <span>
            <strong>Sala privada</strong>
            <small>Não aparece no saguão. Só quem tiver o link entra.</small>
          </span>
        </label>
        {mudou && (
          <p className={estilos.nota}>O link pode mudar. Quem está na sala recebe o novo na hora.</p>
        )}
        <div className={estilos.acoes}>
          <Botao type="button" aparencia="fantasma" disabled={enviando} onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" aparencia="primario" ocupado={enviando} disabled={!mudou || nomeLimpo === ''}>
            {enviando ? 'salvando…' : 'Salvar'}
          </Botao>
        </div>
      </form>
    </Dialogo>
  )
}
