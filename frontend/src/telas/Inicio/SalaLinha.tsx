import { useState, type FormEvent } from 'react'
import { mensagemDoErro } from '../../api/cliente'
import { entrarNaSala, type Credenciais, type SalaNaLista } from '../../api/salas'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { IconeCadeado } from '../../ui/Icone'
import { corDoNome, iniciaisDoNome } from './avatares'
import estilos from './SalaLinha.module.css'

const LIMITE_DO_NOME = 40

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
            {sala.pessoas.map((pessoa) => (
              <span
                key={pessoa}
                className={estilos.avatar}
                style={{ backgroundColor: corDoNome(pessoa) }}
                title={pessoa}
              >
                {iniciaisDoNome(pessoa)}
              </span>
            ))}
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
