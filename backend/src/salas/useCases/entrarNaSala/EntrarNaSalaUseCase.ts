import { Injectable } from '@nestjs/common'
import { env } from '../../../shared/env'
import { Espere, SalaCheia, SalaNaoExiste } from '../../../shared/erros'
import { Freio } from '../../../shared/freio'
import { LivekitRoomProvider } from '../../../shared/livekit/livekit-room.provider'
import { LivekitTokenProvider } from '../../../shared/livekit/livekit-token.provider'
import { Credenciais } from '../../credenciais'
import { gerarIdentidade } from '../../identidade'
import { validarNome } from '../../nome'

const LIMITE_POR_MINUTO = 30
const JANELA_MINUTO_MS = 60_000

@Injectable()
export class EntrarNaSalaUseCase {
  constructor(
    private readonly room: LivekitRoomProvider,
    private readonly tokens: LivekitTokenProvider,
    private readonly freio: Freio,
  ) {}

  async execute(slug: string, seuNomeBruto: unknown, ip: string): Promise<Credenciais> {
    if (!this.freio.permite(`entrar:${ip}`, LIMITE_POR_MINUTO, JANELA_MINUTO_MS)) {
      throw new Espere()
    }

    const seuNome = validarNome(seuNomeBruto)

    const lista = await this.room.listarSalas()
    const sala = lista.find((s) => s.slug === slug)
    if (!sala) throw new SalaNaoExiste()

    if (sala.cheia) throw new SalaCheia()

    // nomeNoSfu carrega o nonce — é ele, não o slug, que vai no grant do token.
    const identidade = gerarIdentidade(seuNome)
    const jwt = await this.tokens.emitir(sala.nomeNoSfu, identidade, seuNome)
    const { livekitUrl } = env()
    return { token: jwt, urlSfu: livekitUrl, slug, nomeDaSala: sala.nome, identidade, nome: seuNome }
  }
}
