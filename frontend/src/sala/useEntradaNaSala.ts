import { useEffect, useRef, useState, type FormEvent } from 'react'
import { entrarNaSala, type Credenciais } from '../api/salas'

interface Opcoes {
  slug: string
  meuNome: string
  nomeSempreEditavel?: boolean
  aoDefinirNome(nome: string): void
  aoEntrar(credenciais: Credenciais): void
  aoFalhar?(): void
}

/** Estado e transação comuns às duas portas da Sala: linha do saguão e link direto. */
export function useEntradaNaSala({
  slug,
  meuNome,
  nomeSempreEditavel = false,
  aoDefinirNome,
  aoEntrar,
  aoFalhar,
}: Opcoes) {
  const precisaDoNome = meuNome.trim() === ''
  const [nomeLocal, setNomeLocal] = useState(nomeSempreEditavel ? meuNome : '')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<unknown>(null)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  const nomeParaEnviar = (nomeSempreEditavel || precisaDoNome ? nomeLocal : meuNome).trim()

  async function enviar(evento?: FormEvent) {
    evento?.preventDefault()
    if (nomeParaEnviar === '') return

    setEnviando(true)
    setErro(null)
    try {
      const credenciais = await entrarNaSala(slug, {
        seuNome: nomeParaEnviar,
        senha: senha || undefined,
      })
      if (!montado.current) return
      aoDefinirNome(nomeParaEnviar)
      aoEntrar(credenciais)
    } catch (falha) {
      if (!montado.current) return
      setErro(falha)
      aoFalhar?.()
    } finally {
      if (montado.current) setEnviando(false)
    }
  }

  function limpar() {
    setSenha('')
    if (!nomeSempreEditavel) setNomeLocal('')
    setErro(null)
  }

  return {
    precisaDoNome,
    nomeLocal,
    setNomeLocal,
    senha,
    setSenha,
    enviando,
    erro,
    podeEntrar: nomeParaEnviar !== '',
    enviar,
    limpar,
  }
}
