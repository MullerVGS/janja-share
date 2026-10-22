import { Injectable } from '@nestjs/common'
import { Espere, SalaExiste } from '../../../shared/erros'
import { Freio } from '../../../shared/freio'
import { LivekitRoomProvider } from '../../../shared/livekit/livekit-room.provider'
import { LivekitTokenProvider } from '../../../shared/livekit/livekit-token.provider'
import { slugDaSala, slugDaSalaPrivada, validarNomeDaSala } from '../../../shared/slug'
import { Credenciais, emitirCredenciais } from '../../credenciais'
import { validarNome } from '../../nome'
import { gerarNomeDeSalaDisponivel } from '../../nomeAutomatico'
import { conferirTeto } from '../../teto'

/** Criar e trazer uma Sala de volta pelo link dividem este freio: as duas fazem nascer encarnação. */
export const LIMITE_DE_CRIACOES_POR_MINUTO = 10
export const JANELA_MINUTO_MS = 60_000

export interface CriarSalaComando {
  nome: unknown
  privada: unknown
  /** Ausente significa fixa: é o padrão (ADR 0013). */
  fixa?: unknown
  seuNome: unknown
  ip: string
}

@Injectable()
export class CriarSalaUseCase {
  constructor(
    private readonly room: LivekitRoomProvider,
    private readonly tokens: LivekitTokenProvider,
    private readonly freio: Freio,
  ) {}

  async execute(comando: CriarSalaComando): Promise<Credenciais> {
    const { nome: nomeBruto, privada: privadaBruta, seuNome: seuNomeBruto, ip } = comando
    if (!this.freio.permite(`criar-sala:${ip}`, LIMITE_DE_CRIACOES_POR_MINUTO, JANELA_MINUTO_MS)) {
      throw new Espere()
    }

    // Nome ausente ou vazio não é erro: é a pessoa não querendo escolher. Só string não-vazia
    // passa por `validarNomeDaSala` — assim `{"nome": 123}` continua sendo nome_da_sala_invalido.
    const pediuNome = typeof nomeBruto === 'string' ? nomeBruto.trim() !== '' : nomeBruto !== undefined && nomeBruto !== null
    // Valida cedo (antes do teto), gera tarde (só depois de `salasAtuais`, que é de onde sai o
    // conjunto de slugs usados). Preserva a ordem antiga de erros: nome inválido continua
    // vencendo `muitas_salas` quando os dois valem ao mesmo tempo.
    const nomeDigitado = pediuNome ? validarNomeDaSala(nomeBruto) : null
    const seuNome = validarNome(seuNomeBruto)
    // O DTO garante o tipo quando o campo vem pela API; a comparação estrita mantém o caso
    // ausente público e evita que valores truthy virem sala privada em chamadas internas.
    const privada = privadaBruta === true
    // Pelo mesmo motivo, só `false` explícito faz a Sala efêmera.
    const fixa = comando.fixa !== false

    // Leitura sem cache: um segundo POST precisa enxergar a sala recém-criada, senão dois
    // pedidos no mesmo instante passariam os dois pela checagem de unicidade e pelo teto.
    const salasAtuais = await this.room.listarSalasSemCache()
    conferirTeto(salasAtuais, fixa)
    // A unicidade continua valendo contra as adormecidas: o nome de uma Sala guardada é dela até
    // ela expirar, mesmo fora do saguão.
    const nomeDaSala = nomeDigitado ?? gerarNomeDeSalaDisponivel(salasAtuais)
    const slug = privada ? slugDaSalaPrivada(nomeDaSala) : slugDaSala(nomeDaSala)
    if (salasAtuais.some((s) => s.slug === slug)) throw new SalaExiste()

    const nomeNoSfu = await this.room.criarSala({ slug, nomeDaSala, privada, fixa })
    return emitirCredenciais(this.tokens, { nomeNoSfu, slug, nome: nomeDaSala, privada, fixa }, seuNome)
  }
}
