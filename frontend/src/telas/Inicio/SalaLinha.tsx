import { useState, type FormEvent } from 'react'
import { mensagemDoErro } from '../../api/cliente'
import { entrarNaSala, LIMITE_DO_NOME, type Credenciais, type SalaNaLista } from '../../api/salas'
import { Aviso } from '../../ui/Aviso'
import { Avatar } from '../../ui/Avatar'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { IconeCadeado } from '../../ui/Icone'
import estilos from './SalaLinha.module.css'

/** Avatares de sobra viram um "+N" — uma fila crescendo sem teto por sala fica ilegível. */
const MAX_AVATARES_VISIVEIS = 6

interface Props {
  sala: SalaNaLista
  /** O que já está em `preferencias.nome` — vazio quando a pessoa nunca preencheu. */
  meuNome: string
  /** Grava o nome digitado aqui de volta em `preferencias`, para a próxima sala não perguntar de novo. */
  aoDefinirNome(nome: string): void
  aoEntrar(credenciais: Credenciais): void
}

/**
 * Uma linha da lista. "Entrar" só abre um formulário na própria linha quando falta alguma coisa
 * — senha da sala, ou o nome de quem está entrando; do contrário vai direto.
 */
export function SalaLinha({ sala, meuNome, aoDefinirNome, aoEntrar }: Props) {
  const precisaDoNome = meuNome.trim() === ''
  const [expandido, setExpandido] = useState(false)
  const [senha, setSenha] = useState('')
  const [nomeLocal, setNomeLocal] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<unknown>(null)

  function clicarEntrar() {
    if (!sala.temSenha && !precisaDoNome) {
      void enviar()
      return
    }
    setExpandido(true)
  }

  function cancelar() {
    setExpandido(false)
    setSenha('')
    setNomeLocal('')
    setErro(null)
  }

  async function enviar(evento?: FormEvent) {
    evento?.preventDefault()
    const seuNome = (precisaDoNome ? nomeLocal : meuNome).trim()
    if (seuNome === '') return

    setEnviando(true)
    setErro(null)
    try {
      const credenciais = await entrarNaSala(sala.slug, { seuNome, senha: sala.temSenha ? senha : undefined })
      if (precisaDoNome) aoDefinirNome(seuNome)
      aoEntrar(credenciais)
    } catch (falha) {
      setErro(falha)
      // Cobre o caminho direto (sem senha, nome já sabido): se o servidor responder diferente por
      // motivo — uma sala que passou a exigir senha entre um poll e outro, por exemplo — a linha
      // precisa de um campo para corrigir, não só da frase do erro.
      setExpandido(true)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <li className={estilos.linha} data-vazia={sala.pessoas.length === 0 || undefined} data-cheia={sala.cheia || undefined}>
      <div className={estilos.info}>
        <span className={estilos.nome}>{sala.nome}</span>
        {sala.temSenha && (
          <span className={estilos.cadeado} title="Sala com senha">
            <IconeCadeado tamanho={14} />
          </span>
        )}
        {sala.telasNoAr > 0 && (
          <span className={estilos.telas}>
            {sala.telasNoAr} {sala.telasNoAr === 1 ? 'tela' : 'telas'} no ar
          </span>
        )}
      </div>

      <div className={estilos.pessoas}>
        {sala.pessoas.length === 0 ? (
          <span className={estilos.vazio}>ninguém agora</span>
        ) : (
          <div className={estilos.avatares}>
            {sala.pessoas.slice(0, MAX_AVATARES_VISIVEIS).map((pessoa, indice) => (
              <Avatar
                key={`${pessoa}-${indice}`}
                className={estilos.avatar}
                nome={pessoa}
                tamanho="mini"
                title={pessoa}
                aria-label={pessoa}
              />
            ))}
            {sala.pessoas.length > MAX_AVATARES_VISIVEIS && (
              <span
                className={estilos.avatarExtra}
                title={sala.pessoas.slice(MAX_AVATARES_VISIVEIS).join(', ')}
              >
                +{sala.pessoas.length - MAX_AVATARES_VISIVEIS}
              </span>
            )}
          </div>
        )}
      </div>

      {erro !== null && (
        <div className={estilos.aviso}>
          <Aviso tom="erro">{mensagemDoErro(erro)}</Aviso>
        </div>
      )}

      {expandido ? (
        <form className={estilos.formulario} onSubmit={enviar}>
          {precisaDoNome && (
            <Campo
              rotulo="Seu nome"
              autoFocus
              maxLength={LIMITE_DO_NOME}
              placeholder="como os outros vão te ver"
              value={nomeLocal}
              onChange={(e) => setNomeLocal(e.target.value)}
            />
          )}
          {sala.temSenha && (
            <Campo
              rotulo="Senha"
              type="password"
              autoFocus={!precisaDoNome}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          )}
          <Botao
            type="submit"
            aparencia="primario"
            ocupado={enviando}
            disabled={(precisaDoNome ? nomeLocal.trim() : meuNome.trim()) === ''}
          >
            Entrar
          </Botao>
          <Botao type="button" aparencia="fantasma" disabled={enviando} onClick={cancelar}>
            Cancelar
          </Botao>
        </form>
      ) : (
        <Botao
          aparencia={sala.cheia ? 'secundario' : 'primario'}
          disabled={sala.cheia}
          ocupado={enviando}
          onClick={clicarEntrar}
        >
          {sala.cheia ? 'cheia' : 'Entrar'}
        </Botao>
      )}
    </li>
  )
}
