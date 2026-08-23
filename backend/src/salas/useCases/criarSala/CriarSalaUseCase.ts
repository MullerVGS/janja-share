import { Injectable } from '@nestjs/common'
import { env } from '../../../shared/env'
import { Espere, MuitasSalas, SalaExiste } from '../../../shared/erros'
import { Freio } from '../../../shared/freio'
import { LivekitRoomProvider } from '../../../shared/livekit/livekit-room.provider'
import { LivekitTokenProvider } from '../../../shared/livekit/livekit-token.provider'
import { cifrar } from '../../../shared/senha'
import { slugDaSala, validarNomeDaSala } from '../../../shared/slug'
import { Credenciais } from '../../credenciais'
import { gerarIdentidade } from '../../identidade'
import { validarNome } from '../../nome'
import { gerarNomeDeSala } from '../../nomeAutomatico'
import { SalasRepository } from '../../repositories/salas.repository'

const TETO_SALAS = 20
const LIMITE_POR_MINUTO = 10
const JANELA_MINUTO_MS = 60_000

@Injectable()
export class CriarSalaUseCase {
  constructor(
    private readonly salas: SalasRepository,
    private readonly room: LivekitRoomProvider,
    private readonly tokens: LivekitTokenProvider,
    private readonly freio: Freio,
  ) {}

  async execute(nomeBruto: unknown, senhaBruta: unknown, seuNomeBruto: unknown, ip: string): Promise<Credenciais> {
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
    // senha não é um dos "nomes" (que precisam de código de erro dedicado): tipo errado é
    // recusado pelo DTO (@IsString + @IsOptional); aqui só decide "tem senha ou não".
    const senha = typeof senhaBruta === 'string' && senhaBruta.length > 0 ? senhaBruta : undefined

    // Leitura sem cache: um segundo POST precisa enxergar a sala recém-criada; caso contrário,
    // poderia apagar o hash de uma sala viva antes de descobrir a colisão no SFU.
    const salasAtuais = await this.room.listarSalasSemCache()
    if (salasAtuais.length >= TETO_SALAS) throw new MuitasSalas()
    const nomeDaSala = nomeDigitado ?? gerarNomeDeSala(new Set(salasAtuais.map((s) => s.slug)))
    const slug = slugDaSala(nomeDaSala)
    if (salasAtuais.some((s) => s.slug === slug)) throw new SalaExiste()

    // Linha órfã do mesmo slug: sala morta que deixou hash para trás. Sem apagar antes, um nome
    // reusado herdaria a senha de uma sala que ninguém lembra.
    await this.salas.apagar(slug)
    if (senha) await this.salas.gravarHash(slug, await cifrar(senha))

    // nomeNoSfu carrega o nonce — é ele, não o slug, que vai no grant do token.
    const nomeNoSfu = await this.room.criarSala({ slug, nomeDaSala })

    const identidade = gerarIdentidade(seuNome)
    const jwt = await this.tokens.emitir(nomeNoSfu, identidade, seuNome)
    const { livekitUrl } = env()
    return { token: jwt, urlSfu: livekitUrl, slug, nomeDaSala, identidade, nome: seuNome }
  }
}
