import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { env } from '../env'

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env().databaseUrl,
  synchronize: false,
  entities: [__dirname + '/entidades/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
})
