import { Injectable } from '@nestjs/common'
import { env } from '../../../shared/env'
import { Espere, MuitasSalas, SalaExiste } from '../../../shared/erros'
import { Freio } from '../../../shared/freio'
import { LivekitRoomProvider } from '../../../shared/livekit/livekit-room.provider'
import { LivekitTokenProvider } from '../../../shared/livekit/livekit-token.provider'
import { slugDaSala, slugDaSalaPrivada, validarNomeDaSala } from '../../../shared/slug'
import { Credenciais } from '../../credenciais'
import { gerarIdentidade } from '../../identidade'
import { validarNome } from '../../nome'
import { gerarNomeDeSalaDisponivel } from '../../nomeAutomatico'

const TETO_SALAS = 20
const LIMITE_POR_MINUTO = 10
const JANELA_MINUTO_MS = 60_000

export interface CriarSalaComando {
  nome: unknown
  privada: unknown
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
    if (!this.freio.permite(`criar-sala:${ip}`, LIMITE_POR_MINUTO, JANELA_MINUTO_MS)) {
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

    // Leitura sem cache: um segundo POST precisa enxergar a sala recém-criada, senão dois
    // pedidos no mesmo instante passariam os dois pela checagem de unicidade e pelo teto.
    const salasAtuais = await this.room.listarSalasSemCache()
    if (salasAtuais.length >= TETO_SALAS) throw new MuitasSalas()
    const nomeDaSala = nomeDigitado ?? gerarNomeDeSalaDisponivel(salasAtuais)
    const slug = privada ? slugDaSalaPrivada(nomeDaSala) : slugDaSala(nomeDaSala)
    if (salasAtuais.some((s) => s.slug === slug)) throw new SalaExiste()

    // nomeNoSfu carrega o nonce — é ele, não o slug, que vai no grant do token.
    const nomeNoSfu = await this.room.criarSala({ slug, nomeDaSala, privada })

    const identidade = gerarIdentidade(seuNome)
    const jwt = await this.tokens.emitir(nomeNoSfu, identidade, seuNome)
    const { livekitUrl } = env()
    return { token: jwt, urlSfu: livekitUrl, slug, nomeDaSala, identidade, nome: seuNome }
  }
}
