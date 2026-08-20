import { MigrationInterface, QueryRunner } from 'typeorm'

export class Fundacao1787198844835 implements MigrationInterface {
  name = 'Fundacao1787198844835'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE salas (
        slug varchar(32) PRIMARY KEY,
        senha_hash text NOT NULL,
        criada_em timestamptz NOT NULL DEFAULT now()
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE salas`)
  }
}
