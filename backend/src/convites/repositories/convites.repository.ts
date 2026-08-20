import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash, randomBytes } from 'node:crypto'
import { Repository } from 'typeorm'
import { Convite } from '../../shared/db/entidades/convite.entity'

export interface ConviteConsumido {
  id: string
}

@Injectable()
export class ConvitesRepository {
  constructor(@InjectRepository(Convite) private readonly convites: Repository<Convite>) {}

  static gerarToken(): string {
    return randomBytes(24).toString('base64url')
  }

  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  buscarPorHash(hash: string): Promise<Convite | null> {
    return this.convites.findOne({ where: { hash } })
  }

  listar(): Promise<Convite[]> {
    return this.convites.find({ order: { criadoEm: 'DESC' } })
  }

  criar(rotulo: string, expiraEm: Date, usosMax: number | null, hash: string): Promise<Convite> {
    return this.convites.save(this.convites.create({ rotulo, expiraEm, usosMax, hash }))
  }

  /**
   * true se o id existe (e foi marcado revogado agora, ou já estava — idempotente).
   *
   * TypeORM 0.3 com driver postgres: `manager.query()` de um UPDATE/DELETE — mesmo com
   * RETURNING — devolve o par `[rows, rowCount]`, não as linhas direto (SELECT/INSERT
   * devolvem `rows` direto; só UPDATE/DELETE são o par). Sem destruturar, `rows` some dentro
   * do índice 0 e o índice 0 vira sempre um array truthy, mesmo quando RETURNING não achou
   * nenhuma linha — ver memória `typeorm-query-update-returning`.
   */
  async revogar(id: string): Promise<boolean> {
    const [linhas] = await this.convites.manager.query<[{ id: string }[], number]>(
      `UPDATE convites SET revogado_em = COALESCE(revogado_em, now()) WHERE id = $1 RETURNING id`,
      [id],
    )
    return linhas.length > 0
  }

  /**
   * Consome um uso de forma atômica: a condição inteira (não revogado, não expirado, usos <
   * usosMax) vai na cláusula WHERE do UPDATE. Postgres serializa updates concorrentes na mesma
   * linha (lock de linha + MVCC), então dois `entrar` simultâneos nunca fazem `usos` passar de
   * `usosMax` — o requisito é resolvido no banco, não em JS. `null` quando a condição falhou
   * (convite não existe, ou existe mas está inválido); o chamador decide o código de erro
   * exato com uma SELECT de diagnóstico separada.
   *
   * `[linhas]`: ver o comentário de `revogar()` acima sobre o retorno `[rows, rowCount]` de
   * UPDATE via `manager.query()` no driver postgres do TypeORM 0.3.
   */
  async consumirUso(hash: string): Promise<ConviteConsumido | null> {
    const [linhas] = await this.convites.manager.query<[ConviteConsumido[], number]>(
      `
      UPDATE convites
      SET usos = usos + 1
      WHERE hash = $1
        AND revogado_em IS NULL
        AND expira_em > now()
        AND (usos_max IS NULL OR usos < usos_max)
      RETURNING id
      `,
      [hash],
    )
    return linhas[0] ?? null
  }
}
