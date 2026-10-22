import { Injectable } from '@nestjs/common'
import { TokenVerifier } from 'livekit-server-sdk'
import { env } from '../../../shared/env'
import { Espere, ForaDaSala, SalaExiste, SalaNaoExiste } from '../../../shared/erros'
import { Freio } from '../../../shared/freio'
import { LivekitRoomProvider, SalaNoSfu } from '../../../shared/livekit/livekit-room.provider'
import { slugDaSala, slugDaSalaPrivada, sufixoDoSlugPrivado, validarNomeDaSala } from '../../../shared/slug'
import { assinarLink } from '../../assinatura'

const LIMITE_POR_MINUTO = 10
const JANELA_MINUTO_MS = 60_000
/** Quantos slugs antigos a encarnação lembra. Trocar de nome mais que isso numa semana é raro. */
const SLUGS_LEMBRADOS = 5

export interface AjustarSalaComando {
  slug: string
  /** O JWT do LiveKit de quem pede: é a prova de que a pessoa está nesta encarnação. */
  token: string | null
  nome: unknown
  privada: unknown
  ip: string
}

/** O que a Sala passa a ser — o mesmo que quem está dentro recebe pelo metadata. */
export interface SalaAjustada {
  slug: string
  nomeDaSala: string
  privada: boolean
  fixa: boolean
  assinatura: string | null
}

/**
 * Muda nome e visibilidade de uma Sala viva, sem recriá-la (ADR 0013). Não há dono: qualquer
 * Pessoa presente pode, e presente quer dizer as duas coisas — um token desta encarnação e a
 * identidade dele dentro da Sala agora.
 *
 * O slug segue o nome e a visibilidade: pública usa o slug do nome; privada que continua
 * privada guarda o sufixo sorteado, para o segredo do link não mudar junto com o nome; pública
 * que vira privada ganha sufixo novo. Quando o slug muda, o slug antigo vai para `anteriores`:
 * só um link assinado dele ainda chega aqui (ver `EntrarNaSalaUseCase`); sem assinatura, ele
 * deixa de achar a Sala — o que impede que o nome público antigo leve a uma Sala agora privada.
 */
@Injectable()
export class AjustarSalaUseCase {
  constructor(
    private readonly room: LivekitRoomProvider,
    private readonly freio: Freio,
  ) {}

  async execute({ slug, token, nome: nomeBruto, privada: privadaBruta, ip }: AjustarSalaComando): Promise<SalaAjustada> {
    if (!this.freio.permite(`ajustar-sala:${ip}`, LIMITE_POR_MINUTO, JANELA_MINUTO_MS)) {
      throw new Espere()
    }

    const salas = await this.room.listarSalasSemCache()
    const sala = salas.find((s) => s.slug === slug)
    if (!sala) throw new SalaNaoExiste()
    await this.conferirPresenca(sala, token)

    const nome = nomeBruto === undefined ? sala.nome : validarNomeDaSala(nomeBruto)
    // O DTO garante booleano quando vem; ausente mantém a visibilidade de agora.
    const privada = typeof privadaBruta === 'boolean' ? privadaBruta : sala.privada === true
    const fixa = sala.fixa === true

    const novoSlug = slugAjustado(sala, nome, privada)
    if (novoSlug !== sala.slug && salas.some((s) => s.slug === novoSlug && s.nomeNoSfu !== sala.nomeNoSfu)) {
      throw new SalaExiste()
    }

    const assinatura = fixa ? assinarLink({ slug: novoSlug, nome, privada }) : null
    const anteriores = (novoSlug === sala.slug ? (sala.anteriores ?? []) : [sala.slug, ...(sala.anteriores ?? [])])
      .filter((antigo) => antigo !== novoSlug)
      .slice(0, SLUGS_LEMBRADOS)
    await this.room.ajustarSala(sala.nomeNoSfu, {
      slug: novoSlug,
      nome,
      privada,
      fixa,
      assinatura,
      ...(anteriores.length > 0 ? { anteriores } : {}),
    })
    return { slug: novoSlug, nomeDaSala: nome, privada, fixa, assinatura }
  }

  private async conferirPresenca(sala: SalaNoSfu, token: string | null): Promise<void> {
    if (!token) throw new ForaDaSala()
    const { livekitApiKey, livekitApiSecret } = env()
    let identidade: string | undefined
    let encarnacao: string | undefined
    try {
      const claims = await new TokenVerifier(livekitApiKey, livekitApiSecret).verify(token)
      identidade = claims.sub
      encarnacao = claims.video?.room
    } catch {
      throw new ForaDaSala()
    }
    if (!identidade || encarnacao !== sala.nomeNoSfu) throw new ForaDaSala()

    const presentes = await this.room.participantes(sala.nomeNoSfu)
    if (!presentes.some((p) => p.identidade === identidade)) throw new ForaDaSala()
  }
}

function slugAjustado(sala: SalaNoSfu, nome: string, privada: boolean): string {
  if (!privada) return slugDaSala(nome)
  const sufixo = sala.privada === true ? sufixoDoSlugPrivado(sala.slug) : null
  return sufixo ? slugDaSalaPrivada(nome, sufixo) : slugDaSalaPrivada(nome)
}
