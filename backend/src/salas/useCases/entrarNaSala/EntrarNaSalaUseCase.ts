import { Injectable } from '@nestjs/common'
import { AssinaturaInvalida, Espere, SalaCheia, SalaExpirada, SalaNaoExiste } from '../../../shared/erros'
import { Freio } from '../../../shared/freio'
import { LivekitRoomProvider, SalaNoSfu } from '../../../shared/livekit/livekit-room.provider'
import { LivekitTokenProvider } from '../../../shared/livekit/livekit-token.provider'
import { lerAssinatura } from '../../assinatura'
import { Credenciais, emitirCredenciais } from '../../credenciais'
import { validarNome } from '../../nome'
import { conferirTeto } from '../../teto'
import { JANELA_MINUTO_MS as JANELA_DE_CRIAR_MS, LIMITE_DE_CRIACOES_POR_MINUTO } from '../criarSala/CriarSalaUseCase'

const LIMITE_POR_MINUTO = 30
const JANELA_MINUTO_MS = 60_000

export interface EntrarNaSalaComando {
  slug: string
  seuNome: unknown
  /** O `?k=` do link, quando a Sala é fixa. Só é lido se a Sala não existir mais. */
  assinatura?: unknown
  ip: string
}

@Injectable()
export class EntrarNaSalaUseCase {
  /**
   * Recriações em voo, por slug. O grupo costuma chegar junto — dois links abertos no mesmo
   * segundo depois de o SFU reiniciar fariam duas encarnações do mesmo slug. Em memória do
   * processo, como o freio: um processo só (ver shared/freio.ts).
   */
  private readonly recriando = new Map<string, Promise<SalaNoSfu>>()

  constructor(
    private readonly room: LivekitRoomProvider,
    private readonly tokens: LivekitTokenProvider,
    private readonly freio: Freio,
  ) {}

  async execute({ slug, seuNome: seuNomeBruto, assinatura, ip }: EntrarNaSalaComando): Promise<Credenciais> {
    if (!this.freio.permite(`entrar:${ip}`, LIMITE_POR_MINUTO, JANELA_MINUTO_MS)) {
      throw new Espere()
    }

    const seuNome = validarNome(seuNomeBruto)

    const lista = await this.room.listarSalas()
    const sala = lista.find((s) => s.slug === slug) ?? (await this.trazerDeVolta(slug, assinatura, ip))

    if (sala.cheia) throw new SalaCheia()

    // `sala.slug`, não o do pedido: a Sala achada por um slug anterior já tem outro, e é ele que
    // o app põe na URL.
    return emitirCredenciais(
      this.tokens,
      { nomeNoSfu: sala.nomeNoSfu, slug: sala.slug, nome: sala.nome, privada: sala.privada === true, fixa: sala.fixa === true },
      seuNome,
    )
  }

  /**
   * A Sala não está no SFU com este slug. Só a assinatura de uma Sala fixa a acha de novo: na
   * Sala viva que mudou de nome, ou, dentro do prazo, trazendo-a de volta —
   * como encarnação nova, com nonce novo: um token da encarnação antiga continua sem entrar
   * (ADR 0002). Sem assinatura, o 404 é o de sempre; com uma que não confere ou venceu, o
   * código diz por quê.
   */
  private async trazerDeVolta(slug: string, assinatura: unknown, ip: string): Promise<SalaNoSfu> {
    if (typeof assinatura !== 'string' || assinatura === '') throw new SalaNaoExiste()
    const leitura = lerAssinatura(slug, assinatura)
    if (leitura.tipo === 'invalida') throw new AssinaturaInvalida()

    // O link é de antes de alguém mudar o nome da Sala: ela está viva com outro slug. Seguir
    // para lá — e não recriar a antiga — é o que mantém o grupo junto. Vale também com o prazo
    // vencido: a assinatura conferiu, a pessoa recebeu o link, e a Sala nunca deixou de existir.
    const renomeada = (await this.room.listarSalasSemCache()).find((s) => s.anteriores?.includes(slug))
    if (renomeada) return renomeada

    if (leitura.tipo === 'vencida') throw new SalaExpirada()

    const emVoo = this.recriando.get(slug)
    if (emVoo) return emVoo

    if (!this.freio.permite(`criar-sala:${ip}`, LIMITE_DE_CRIACOES_POR_MINUTO, JANELA_DE_CRIAR_MS)) {
      throw new Espere()
    }

    const recriacao = this.recriar(slug, leitura.nome, leitura.privada)
    this.recriando.set(slug, recriacao)
    try {
      return await recriacao
    } finally {
      this.recriando.delete(slug)
    }
  }

  private async recriar(slug: string, nome: string, privada: boolean): Promise<SalaNoSfu> {
    // Sem cache, como em criar: o teto e a unicidade não podem ler uma lista de 2 s atrás.
    const salasAtuais = await this.room.listarSalasSemCache()
    const viva = salasAtuais.find((s) => s.slug === slug)
    if (viva) return viva

    conferirTeto(salasAtuais, true)
    const nomeNoSfu = await this.room.criarSala({ slug, nomeDaSala: nome, privada, fixa: true })
    return { slug, nomeNoSfu, nome, privada, fixa: true, pessoas: [], telasNoAr: 0, cheia: false }
  }
}
