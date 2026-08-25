import { useEffect, useRef, useState, type FormEvent } from 'react'
import { mensagemDoErro } from '../../api/cliente'
import { criarSala, LIMITE_DO_NOME, sugerirNomeDeSala, type Credenciais } from '../../api/salas'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Dialogo } from '../../ui/Dialogo'
import { IconeDado, IconeSetaBaixo } from '../../ui/Icone'
import estilos from './DialogoCriarSala.module.css'

interface Props {
  aberto: boolean
  /** O que já está em `preferencias.nome` — vazio quando a pessoa nunca preencheu. */
  meuNome: string
  aoDefinirNome(nome: string): void
  aoFechar(): void
  aoCriar(credenciais: Credenciais): void
}

/** Cria e já entra; o nome nasce sugerido e as escolhas menos comuns ficam recolhidas. */
export function DialogoCriarSala({ aberto, meuNome, aoDefinirNome, aoFechar, aoCriar }: Props) {
  const precisaDoNome = meuNome.trim() === ''
  const [nomeDaSala, setNomeDaSala] = useState('')
  const [senha, setSenha] = useState('')
  const [privada, setPrivada] = useState(false)
  const [nomeLocal, setNomeLocal] = useState('')
  const [sorteandoNome, setSorteandoNome] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<unknown>(null)
  const sorteioAtual = useRef(0)

  async function sortearNome(preservarNomeDigitado: boolean) {
    const sorteio = ++sorteioAtual.current
    setSorteandoNome(true)
    setErro(null)
    try {
      const nome = await sugerirNomeDeSala(preservarNomeDigitado ? undefined : nomeDaSala)
      if (sorteio !== sorteioAtual.current) return
      setNomeDaSala((atual) => (preservarNomeDigitado && atual.trim() !== '' ? atual : nome))
    } catch (falha) {
      if (sorteio === sorteioAtual.current) setErro(falha)
    } finally {
      if (sorteio === sorteioAtual.current) setSorteandoNome(false)
    }
  }

  useEffect(() => {
    if (!aberto) {
      sorteioAtual.current += 1
      return
    }
    setNomeDaSala('')
    setSenha('')
    setPrivada(false)
    setNomeLocal('')
    setErro(null)
    void sortearNome(true)
  }, [aberto])

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const seuNome = (precisaDoNome ? nomeLocal : meuNome).trim()
    const nome = nomeDaSala.trim()
    if (seuNome === '' || nome === '') return

    setEnviando(true)
    setErro(null)
    try {
      const credenciais = await criarSala({
        nome,
        senha: senha || undefined,
        privada: privada || undefined,
        seuNome,
      })
      if (precisaDoNome) aoDefinirNome(seuNome)
      aoCriar(credenciais)
    } catch (falha) {
      setErro(falha)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialogo aberto={aberto} titulo="Criar sala" aoFechar={aoFechar}>
      <form className={estilos.formulario} onSubmit={enviar} noValidate>
        {erro !== null && <Aviso tom="erro">{mensagemDoErro(erro)}</Aviso>}
        <div className={estilos.nomeComDado}>
          <Campo
            rotulo="Nome da sala"
            autoFocus
            maxLength={LIMITE_DO_NOME}
            placeholder={sorteandoNome ? 'sorteando um nome…' : 'como a sala vai aparecer'}
            value={nomeDaSala}
            onChange={(e) => setNomeDaSala(e.target.value)}
          />
          <button
            type="button"
            className={estilos.dado}
            aria-label="Gerar outro nome"
            title="Gerar outro nome"
            aria-busy={sorteandoNome}
            disabled={sorteandoNome}
            onClick={() => void sortearNome(false)}
          >
            <IconeDado tamanho={21} />
          </button>
        </div>
        {precisaDoNome && (
          <Campo
            rotulo="Seu nome"
            maxLength={LIMITE_DO_NOME}
            placeholder="como os outros vão te ver"
            value={nomeLocal}
            onChange={(e) => setNomeLocal(e.target.value)}
          />
        )}
        <details className={estilos.avancadas}>
          <summary className={estilos.resumoDasAvancadas}>
            <span>Opções avançadas</span>
            <IconeSetaBaixo tamanho={17} />
          </summary>
          <div className={estilos.conteudoDasAvancadas}>
            <label className={estilos.opcaoPrivada}>
              <input
                type="checkbox"
                checked={privada}
                onChange={(evento) => setPrivada(evento.target.checked)}
              />
              <span>
                <strong>Sala privada</strong>
                <small>Não aparece no saguão. Quem tiver o link ainda pode entrar.</small>
              </span>
            </label>
            <Campo
              rotulo="Senha (opcional)"
              type="password"
              placeholder="deixe em branco para entrar sem senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
        </details>
        <Botao
          type="submit"
          aparencia="primario"
          blocoInteiro
          ocupado={enviando}
          disabled={nomeDaSala.trim() === '' || (precisaDoNome && nomeLocal.trim() === '')}
        >
          {enviando ? 'criando…' : 'Criar sala'}
        </Botao>
      </form>
    </Dialogo>
  )
}
