import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ErroDaApi, mensagemDoErro } from '../../api/cliente'
import { criarSala, LIMITE_DO_NOME, type Credenciais } from '../../api/salas'
import { gravarPreferencias, lerPreferencias } from '../../preferencias'
import { useEntradaNaSala } from '../../sala/useEntradaNaSala'
import { lerCargaDaAssinatura, PARAMETRO_DA_ASSINATURA, palpiteDoSlug } from '../../salas/link'
import { esquecerSala, salaLembrada } from '../../salas/suasSalas'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Dialogo } from '../../ui/Dialogo'
import estilos from './EntradaDaSala.module.css'

interface Props {
  slug: string
  aoEntrar(credenciais: Credenciais): void
  aoVoltar(): void
}

/**
 * O que se sabe da Sala antes de entrar: o link diz (a carga da assinatura), "Suas salas"
 * lembra, ou o slug dá um palpite. Serve ao título da espera e ao "Criar de novo".
 */
function oQueSeSabe(slug: string, assinatura: string | undefined): { nome: string; privada: boolean } {
  const carga = lerCargaDaAssinatura(assinatura)
  if (carga) return { nome: carga.nome, privada: carga.privada }
  const lembrada = salaLembrada(slug)
  if (lembrada) return { nome: lembrada.nome, privada: lembrada.privada }
  return palpiteDoSlug(slug)
}

/**
 * Porta para quem abriu o link em outra aba ou navegador e ainda não tem o passe da Sala.
 *
 * O link é a identidade (ADR 0013): com o nome da pessoa já guardado neste navegador, a entrada
 * é direta, sem formulário. O formulário fica para quem nunca deu nome — e para quando a
 * entrada direta esbarra num erro que a pessoa pode tentar de novo.
 */
export function EntradaDaSala({ slug, aoEntrar, aoVoltar }: Props) {
  const [busca] = useSearchParams()
  const assinatura = busca.get(PARAMETRO_DA_ASSINATURA) ?? undefined
  const [meuNome] = useState(() => lerPreferencias().nome)
  const direta = meuNome.trim() !== ''
  const entrada = useEntradaNaSala({
    slug,
    assinatura,
    meuNome,
    nomeSempreEditavel: true,
    aoDefinirNome: (nome) => gravarPreferencias({ nome }),
    aoEntrar,
  })
  const sala = oQueSeSabe(slug, assinatura)

  // Uma tentativa só por montagem, mesmo com o efeito rodando duas vezes no StrictMode.
  const tentou = useRef(false)
  useEffect(() => {
    if (!direta || tentou.current) return
    tentou.current = true
    void entrada.enviar()
  }, [])

  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  const [recriando, setRecriando] = useState(false)
  const [erroAoRecriar, setErroAoRecriar] = useState<unknown>(null)

  async function criarDeNovo() {
    const seuNome = entrada.nomeParaEnviar
    if (seuNome === '') return
    setRecriando(true)
    setErroAoRecriar(null)
    try {
      const credenciais = await criarSala({ nome: sala.nome, privada: sala.privada || undefined, seuNome })
      if (!montado.current) return
      gravarPreferencias({ nome: seuNome })
      if (credenciais.slug !== slug) esquecerSala(slug)
      aoEntrar(credenciais)
    } catch (falha) {
      if (!montado.current) return
      // Alguém da turma recriou a Sala primeiro: o nome está ocupado por ela. Entrar.
      if (falha instanceof ErroDaApi && falha.codigo === 'sala_existe') {
        void entrada.enviar()
        return
      }
      setErroAoRecriar(falha)
    } finally {
      if (montado.current) setRecriando(false)
    }
  }

  const codigo = entrada.erro instanceof ErroDaApi ? entrada.erro.codigo : null

  if (codigo === 'assinatura_invalida') {
    return (
      <Dialogo aberto titulo="Este link não abre a sala" aoFechar={aoVoltar}>
        <div className={estilos.formulario}>
          <p className={estilos.contexto}>
            O endereço chegou alterado ou incompleto. Peça o convite de novo a quem está na sala.
          </p>
          <div className={estilos.acoes}>
            <Botao type="button" aparencia="primario" onClick={aoVoltar}>
              Voltar ao saguão
            </Botao>
          </div>
        </div>
      </Dialogo>
    )
  }

  if (codigo === 'sala_expirada' || codigo === 'sala_nao_existe') {
    return (
      <Dialogo aberto titulo="Esta sala expirou" aoFechar={aoVoltar}>
        <div className={estilos.formulario}>
          <p className={estilos.contexto}>
            {codigo === 'sala_expirada' ? (
              <>
                Ninguém voltou a <strong>{sala.nome}</strong> em 7 dias, e ela deixou de ser guardada.
              </>
            ) : (
              <>
                <strong>#{slug}</strong> não está mais no ar e não ficou guardada.
              </>
            )}
          </p>
          {erroAoRecriar !== null && <Aviso tom="erro">{mensagemDoErro(erroAoRecriar)}</Aviso>}
          {entrada.nomeParaEnviar === '' && (
            <Campo
              rotulo="Seu nome"
              maxLength={LIMITE_DO_NOME}
              placeholder="como os outros vão te ver"
              value={entrada.nomeLocal}
              onChange={(evento) => entrada.setNomeLocal(evento.target.value)}
            />
          )}
          <p className={estilos.nota}>
            A nova se chama <strong>{sala.nome}</strong>
            {sala.privada ? ', é privada e ganha um link novo.' : '.'}
          </p>
          <div className={estilos.acoes}>
            <Botao type="button" aparencia="fantasma" disabled={recriando} onClick={aoVoltar}>
              Voltar ao saguão
            </Botao>
            <Botao
              type="button"
              aparencia="primario"
              ocupado={recriando || entrada.enviando}
              disabled={entrada.nomeParaEnviar === ''}
              onClick={() => void criarDeNovo()}
            >
              {recriando ? 'criando…' : 'Criar de novo com o mesmo nome'}
            </Botao>
          </div>
        </div>
      </Dialogo>
    )
  }

  // Entrada direta em andamento: nada a perguntar, só a espera e a saída.
  if (direta && entrada.erro === null) {
    return (
      <Dialogo aberto titulo="Entrando na sala" aoFechar={aoVoltar}>
        <div className={estilos.formulario}>
          <p className={estilos.contexto} role="status">
            Entrando em <strong>{sala.nome}</strong> como <strong>{meuNome.trim()}</strong>…
          </p>
          <div className={estilos.acoes}>
            <Botao type="button" aparencia="fantasma" onClick={aoVoltar}>
              Voltar ao saguão
            </Botao>
          </div>
        </div>
      </Dialogo>
    )
  }

  return (
    <Dialogo aberto titulo="Entrar na sala" aoFechar={aoVoltar}>
      <form className={estilos.formulario} onSubmit={entrada.enviar} noValidate>
        <p className={estilos.contexto}>
          Você recebeu um link para <strong>#{slug}</strong>. Escolha como os outros vão te ver.
        </p>
        {entrada.erro !== null && <Aviso tom="erro">{mensagemDoErro(entrada.erro)}</Aviso>}
        <Campo
          rotulo="Seu nome"
          autoFocus
          maxLength={LIMITE_DO_NOME}
          placeholder="como os outros vão te ver"
          value={entrada.nomeLocal}
          onChange={(evento) => entrada.setNomeLocal(evento.target.value)}
        />
        <div className={estilos.acoes}>
          <Botao type="button" aparencia="fantasma" disabled={entrada.enviando} onClick={aoVoltar}>
            Voltar ao saguão
          </Botao>
          <Botao
            type="submit"
            aparencia="primario"
            ocupado={entrada.enviando}
            disabled={!entrada.podeEntrar}
          >
            {entrada.enviando ? 'entrando…' : 'Entrar'}
          </Botao>
        </div>
      </form>
    </Dialogo>
  )
}
