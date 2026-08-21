import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Sala } from '../../shared/db/entidades/sala.entity'

@Injectable()
export class SalasRepository {
  constructor(@InjectRepository(Sala) private readonly salas: Repository<Sala>) {}

  /** `null` quando a sala não tem senha (ou nunca teve linha) — contrato: linha só existe para sala protegida. */
  async buscarHash(slug: string): Promise<string | null> {
    const sala = await this.salas.findOne({ where: { slug } })
    return sala?.senhaHash ?? null
  }

  /**
   * Todo slug que hoje tem senha guardada. O teto de 20 salas é de salas VIVAS — esta tabela
   * guarda uma linha por slug protegido já criado, apagada só quando aquele exato slug nasce de
   * novo (ver CriarSalaUseCase); ela cresce com o tempo, não com a lotação atual. Uma leitura
   * cheia ainda basta porque a escala do app é de amigos, não porque a tabela é pequena por
   * contrato.
   */
  async listarSlugsComSenha(): Promise<Set<string>> {
    const linhas = await this.salas.find({ select: ['slug'] })
    return new Set(linhas.map((l) => l.slug))
  }

  /** Idempotente: apagar um slug sem linha não é erro (é o caminho comum — a maioria das salas não tem senha). */
  async apagar(slug: string): Promise<void> {
    await this.salas.delete({ slug })
  }

  async gravarHash(slug: string, senhaHash: string): Promise<void> {
    await this.salas.save(this.salas.create({ slug, senhaHash }))
  }
}
