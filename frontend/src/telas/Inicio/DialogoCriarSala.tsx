import { useEffect, useState, type FormEvent } from 'react'
import { mensagemDoErro } from '../../api/cliente'
import { criarSala, LIMITE_DO_NOME, type Credenciais } from '../../api/salas'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Dialogo } from '../../ui/Dialogo'
import estilos from './DialogoCriarSala.module.css'

interface Props {
  aberto: boolean
  /** O que já está em `preferencias.nome` — vazio quando a pessoa nunca preencheu. */
  meuNome: string
  aoDefinirNome(nome: string): void
  aoFechar(): void
  aoCriar(credenciais: Credenciais): void
}

/** Diálogo de dois campos (nome da sala, senha opcional) que já entra — decisão do spec. */
export function DialogoCriarSala({ aberto, meuNome, aoDefinirNome, aoFechar, aoCriar }: Props) {
  const precisaDoNome = meuNome.trim() === ''
  const [nomeDaSala, setNomeDaSala] = useState('')
  const [senha, setSenha] = useState('')
  const [nomeLocal, setNomeLocal] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<unknown>(null)

  useEffect(() => {
    if (!aberto) return
    setNomeDaSala('')
    setSenha('')
    setNomeLocal('')
    setErro(null)
  }, [aberto])

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const seuNome = (precisaDoNome ? nomeLocal : meuNome).trim()
    if (seuNome === '') return

    setEnviando(true)
    setErro(null)
    try {
      const credenciais = await criarSala({ nome: nomeDaSala.trim() || undefined, senha: senha || undefined, seuNome })
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
        <Campo
          rotulo="Nome da sala (opcional)"
          autoFocus
          maxLength={LIMITE_DO_NOME}
          placeholder="deixe em branco e eu escolho um"
          value={nomeDaSala}
          onChange={(e) => setNomeDaSala(e.target.value)}
        />
        <Campo
          rotulo="Senha (opcional)"
          type="password"
          placeholder="deixe em branco para sala aberta"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        {precisaDoNome && (
          <Campo
            rotulo="Seu nome"
            maxLength={LIMITE_DO_NOME}
            placeholder="como os outros vão te ver"
            value={nomeLocal}
            onChange={(e) => setNomeLocal(e.target.value)}
          />
        )}
        <Botao
          type="submit"
          aparencia="primario"
          blocoInteiro
          ocupado={enviando}
          disabled={precisaDoNome && nomeLocal.trim() === ''}
        >
          {enviando ? 'criando…' : 'Criar sala'}
        </Botao>
      </form>
    </Dialogo>
  )
}
