import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('convites')
export class Convite {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ type: 'varchar', length: 60 }) rotulo!: string
  // sha256 hex do token — o token em si nunca é persistido (contrato).
  @Column({ type: 'char', length: 64, unique: true }) hash!: string
  @Column({ name: 'criado_em', type: 'timestamptz', default: () => 'now()' }) criadoEm!: Date
  @Column({ name: 'expira_em', type: 'timestamptz' }) expiraEm!: Date
  @Column({ name: 'usos_max', type: 'int', nullable: true }) usosMax!: number | null
  @Column({ type: 'int', default: 0 }) usos!: number
  @Column({ name: 'revogado_em', type: 'timestamptz', nullable: true }) revogadoEm!: Date | null
}
