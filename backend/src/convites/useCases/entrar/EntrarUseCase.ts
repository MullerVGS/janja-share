import { Injectable } from '@nestjs/common'
import { env } from '../../../shared/env'
import { ConviteInvalido, erroDoEstado } from '../../../shared/erros'
import { LivekitTokenProvider } from '../../../shared/livekit/livekit-token.provider'
import { calcularEstado } from '../../estado-convite'
import { gerarIdentidade } from '../../identidade'
import { validarNome } from '../../nome'
import { ConvitesRepository } from '../../repositories/convites.repository'

export interface EntrarResultado {
  token: string
  urlSfu: string
  sala: string
  identidade: string
  nome: string
}

@Injectable()
export class EntrarUseCase {
  constructor(
    private readonly convites: ConvitesRepository,
    private readonly tokens: LivekitTokenProvider,
  ) {}

  async execute(conviteBruto: unknown, nomeBruto: unknown): Promise<EntrarResultado> {
    const nome = validarNome(nomeBruto)
    if (typeof conviteBruto !== 'string') throw new ConviteInvalido()

    const hash = ConvitesRepository.hash(conviteBruto)
    const consumido = await this.convites.consumirUso(hash)
    if (!consumido) {
      // O UPDATE atômico falhou — descobrimos o motivo exato com uma leitura à parte. Nada
      // neste sistema "revive" um convite (sem operação de estender prazo/usos), então se o
      // UPDATE falhou a leitura nunca pode achar 'valido' de verdade; o fallback é só para
      // satisfazer o tipo de erroDoEstado() sem lançar um 500 caso essa invariante quebre.
      const convite = await this.convites.buscarPorHash(hash)
      if (!convite) throw new ConviteInvalido()
      const estado = calcularEstado(convite)
      throw erroDoEstado(estado === 'valido' ? 'esgotado' : estado)
    }

    const identidade = gerarIdentidade(nome)
    const jwt = await this.tokens.emitir(identidade, nome)
    const { livekitUrl, sala } = env()
    return { token: jwt, urlSfu: livekitUrl, sala, identidade, nome }
  }
}
