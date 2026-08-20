import { Injectable } from '@nestjs/common'
import { env } from '../../../shared/env'
import { Espere, SalaCheia, SalaNaoExiste, SenhaIncorreta } from '../../../shared/erros'
import { Freio } from '../../../shared/freio'
import { LivekitRoomProvider } from '../../../shared/livekit/livekit-room.provider'
import { LivekitTokenProvider } from '../../../shared/livekit/livekit-token.provider'
import { confere } from '../../../shared/senha'
import { Credenciais } from '../../credenciais'
import { gerarIdentidade } from '../../identidade'
import { validarNome } from '../../nome'
import { SalasRepository } from '../../repositories/salas.repository'

const LIMITE_POR_MINUTO = 30
const JANELA_MINUTO_MS = 60_000
const LIMITE_SENHAS_ERRADAS = 5
const JANELA_SENHA_MS = 30_000

@Injectable()
export class EntrarNaSalaUseCase {
  constructor(
    private readonly salas: SalasRepository,
    private readonly room: LivekitRoomProvider,
    private readonly tokens: LivekitTokenProvider,
    private readonly freio: Freio,
  ) {}

  async execute(slug: string, senhaBruta: unknown, seuNomeBruto: unknown, ip: string): Promise<Credenciais> {
    if (!this.freio.permite(`entrar:${ip}`, LIMITE_POR_MINUTO, JANELA_MINUTO_MS)) throw new Espere()

    const seuNome = validarNome(seuNomeBruto)

    const lista = await this.room.listarSalas()
    const sala = lista.find((s) => s.slug === slug)
    if (!sala) throw new SalaNaoExiste()

    const hash = await this.salas.buscarHash(slug)
    if (hash) {
      const senha = typeof senhaBruta === 'string' ? senhaBruta : ''
      if (!confere(senha, hash)) {
        // Só a tentativa ERRADA consome o freio — acertar de primeira nunca penaliza.
        if (!this.freio.permite(`senha:${ip}:${slug}`, LIMITE_SENHAS_ERRADAS, JANELA_SENHA_MS)) throw new Espere()
        throw new SenhaIncorreta()
      }
    }

    if (sala.cheia) throw new SalaCheia()

    const identidade = gerarIdentidade(seuNome)
    const jwt = await this.tokens.emitir(slug, identidade, seuNome)
    const { livekitUrl } = env()
    return { token: jwt, urlSfu: livekitUrl, slug, nomeDaSala: sala.nome, identidade, nome: seuNome }
  }
}
