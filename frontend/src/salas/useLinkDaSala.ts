import { RoomEvent, type Room } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Credenciais, SalaAjustada } from '../api/salas'
import { useSessao } from '../sessao/sessao'
import { enderecoDaSala } from './link'
import { lembrarSala } from './suasSalas'

/** O que a Sala é agora: nome, slug, visibilidade, guarda e o `?k=` do link. */
export type LinkDaSala = SalaAjustada

/** O aviso de "mudaram o nome" fica o bastante para ser lido, e sai sozinho. */
export const AVISO_DE_LINK_MS = 8000

function linkDasCredenciais(credenciais: Credenciais): LinkDaSala {
  const fixa = credenciais.fixa === true
  return {
    slug: credenciais.slug,
    nomeDaSala: credenciais.nomeDaSala,
    privada: credenciais.privada === true,
    fixa,
    assinatura: fixa ? (credenciais.assinatura ?? null) : null,
  }
}

/**
 * O metadata que o servidor grava ao mudar nome ou visibilidade (`RoomMetadataChanged`). Sem
 * assinatura no metadata, a de agora continua valendo se o slug não mudou.
 */
export function lerMetadataDaSala(metadata: string | undefined, atual: LinkDaSala): LinkDaSala | null {
  if (!metadata) return null
  let dados: Record<string, unknown>
  try {
    const cru: unknown = JSON.parse(metadata)
    if (cru === null || typeof cru !== 'object') return null
    dados = cru as Record<string, unknown>
  } catch {
    return null
  }
  if (typeof dados.slug !== 'string' || typeof dados.nome !== 'string') return null
  const fixa = dados.fixa === true
  const assinatura =
    typeof dados.assinatura === 'string' ? dados.assinatura : dados.slug === atual.slug ? atual.assinatura : null
  return {
    slug: dados.slug,
    nomeDaSala: dados.nome,
    privada: dados.privada === true,
    fixa,
    assinatura: fixa ? assinatura : null,
  }
}

function mesmoLink(a: LinkDaSala, b: LinkDaSala): boolean {
  return (
    a.slug === b.slug &&
    a.nomeDaSala === b.nomeDaSala &&
    a.privada === b.privada &&
    a.fixa === b.fixa &&
    a.assinatura === b.assinatura
  )
}

interface Estado {
  de: Credenciais | null
  link: LinkDaSala | null
  aviso: string | null
}

function estadoDe(credenciais: Credenciais | null): Estado {
  return { de: credenciais, link: credenciais ? linkDasCredenciais(credenciais) : null, aviso: null }
}

/**
 * O link é a identidade da Sala (ADR 0013), e este hook o mantém verdadeiro enquanto a pessoa
 * está dentro: a barra de endereço (e com ela o "Copiar convite") leva sempre o slug e a
 * assinatura de agora; a sessão da aba acompanha o slug novo, para o F5 continuar entrando; e
 * a Sala fixa vai para o topo de "Suas salas".
 *
 * Quando alguém muda nome ou visibilidade, o servidor grava o metadata da encarnação e o SFU o
 * entrega a todos — é por esse evento que quem não mexeu em nada recebe o link novo.
 */
export function useLinkDaSala(sala: Room | null, credenciais: Credenciais | null) {
  const [estado, setEstado] = useState<Estado>(() => estadoDe(credenciais))
  if (estado.de !== credenciais) setEstado(estadoDe(credenciais))

  const sessao = useSessao()
  const navegar = useNavigate()
  const local = useLocation()
  // O efeito de sincronia roda por mudança do link, não da sessão: `guardar` muda de identidade a
  // cada gravação, e tê-lo nas dependências faria cada gravação disparar a próxima.
  const atuais = useRef({ sessao, navegar, local })
  atuais.current = { sessao, navegar, local }
  const ultimo = useRef<{ de: Credenciais | null; slug: string | null }>({ de: null, slug: null })

  const aplicar = useCallback((link: LinkDaSala, aviso: string | null = null) => {
    setEstado((atual) => {
      if (!atual.link || mesmoLink(atual.link, link)) return atual
      return { ...atual, link, aviso }
    })
  }, [])

  useEffect(() => {
    if (!sala) return
    const aoMudarMetadata = (metadata: string) => {
      setEstado((atual) => {
        if (!atual.link) return atual
        const lido = lerMetadataDaSala(metadata, atual.link)
        if (!lido || mesmoLink(lido, atual.link)) return atual
        const mudouONome = lido.nomeDaSala !== atual.link.nomeDaSala
        const mudouOLink = lido.slug !== atual.link.slug
        const aviso = mudouONome
          ? `A sala agora se chama ${lido.nomeDaSala}.${mudouOLink ? ' O link mudou junto — o convite já é o novo.' : ''}`
          : mudouOLink
            ? `A sala agora é ${lido.privada ? 'privada' : 'pública'}. O link mudou — o convite já é o novo.`
            : atual.aviso
        return { ...atual, link: lido, aviso }
      })
    }
    sala.on(RoomEvent.RoomMetadataChanged, aoMudarMetadata)
    return () => {
      sala.off(RoomEvent.RoomMetadataChanged, aoMudarMetadata)
    }
  }, [sala])

  useEffect(() => {
    const { link, de } = estado
    if (!link || !de) return
    const { sessao: { guardar, encerrar }, navegar: irPara, local: { pathname, search } } = atuais.current

    const antes = ultimo.current.de === de && ultimo.current.slug ? ultimo.current.slug : de.slug
    ultimo.current = { de, slug: link.slug }

    // Mesmo token, mesma encarnação: só o slug e o que se mostra mudam. A Sala reconhece a
    // credencial pelo token e não reconecta.
    guardar({ ...de, ...link })
    if (antes !== link.slug) encerrar(antes)
    if (link.fixa) {
      lembrarSala(
        { slug: link.slug, nome: link.nomeDaSala, privada: link.privada, assinatura: link.assinatura },
        antes !== link.slug ? antes : undefined,
      )
    }

    const destino = enderecoDaSala(link.slug, link.assinatura)
    if (`${pathname}${search}` !== destino) irPara(destino, { replace: true })
  }, [estado.link, estado.de])

  useEffect(() => {
    if (!estado.aviso) return
    const some = setTimeout(() => setEstado((atual) => ({ ...atual, aviso: null })), AVISO_DE_LINK_MS)
    return () => clearTimeout(some)
  }, [estado.aviso])

  return { link: estado.link, aviso: estado.aviso, aplicar }
}
