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
    if (!this.freio.permite(`criar-sala:${ip}`, LIMITE_POR_MINUTO, JANELA_MINUTO_MS)) throw new Espere()

    const nomeDaSala = validarNomeDaSala(nomeBruto)
    const slug = slugDaSala(nomeDaSala)
    const seuNome = validarNome(seuNomeBruto)
    const senha = typeof senhaBruta === 'string' && senhaBruta.length > 0 ? senhaBruta : undefined

    // Uma ida só ao SFU (cache de 2s) resolve os dois: teto global e slug já ocupado.
    const salasAtuais = await this.room.listarSalas()
    if (salasAtuais.length >= TETO_SALAS) throw new MuitasSalas()
    if (salasAtuais.some((s) => s.slug === slug)) throw new SalaExiste()

    // Linha órfã do mesmo slug: sala morta que deixou hash para trás. Sem apagar antes, um nome
    // reusado herdaria a senha de uma sala que ninguém lembra.
    await this.salas.apagar(slug)
    if (senha) await this.salas.gravarHash(slug, cifrar(senha))

    await this.room.criarSala({ slug, nomeDaSala })

    const identidade = gerarIdentidade(seuNome)
    const jwt = await this.tokens.emitir(slug, identidade, seuNome)
    const { livekitUrl } = env()
    return { token: jwt, urlSfu: livekitUrl, slug, nomeDaSala, identidade, nome: seuNome }
  }
}
