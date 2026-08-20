import { Column, Entity, PrimaryColumn } from 'typeorm'

/** Linha só existe para sala protegida (contrato) — sem senha, sem linha nenhuma. */
@Entity('salas')
export class Sala {
  @PrimaryColumn({ type: 'varchar', length: 32 }) slug!: string
  // "salt:hash" em hex (shared/senha.ts) — o token da sala nunca é o que fica gravado.
  @Column({ name: 'senha_hash', type: 'text' }) senhaHash!: string
  @Column({ name: 'criada_em', type: 'timestamptz', default: () => 'now()' }) criadaEm!: Date
}
