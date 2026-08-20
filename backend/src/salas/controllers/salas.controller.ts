import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common'
import { Request } from 'express'
import { ipDoPedido } from '../../shared/ip'
import { CriarSalaDto } from '../dto/criar-sala.dto'
import { EntrarSalaDto } from '../dto/entrar-sala.dto'
import { CriarSalaUseCase } from '../useCases/criarSala/CriarSalaUseCase'
import { EntrarNaSalaUseCase } from '../useCases/entrarNaSala/EntrarNaSalaUseCase'
import { ListarSalasUseCase } from '../useCases/listarSalas/ListarSalasUseCase'

@Controller('salas')
export class SalasController {
  constructor(
    private readonly listar: ListarSalasUseCase,
    private readonly criar: CriarSalaUseCase,
    private readonly entrar: EntrarNaSalaUseCase,
  ) {}

  @Get()
  listarSalas() {
    return this.listar.execute()
  }

  // 201 padrão do Nest: diferente de entrar, aqui a sala é criada de verdade no SFU.
  @Post()
  criarSala(@Body() dto: CriarSalaDto, @Req() req: Request) {
    return this.criar.execute(dto.nome, dto.senha, dto.seuNome, ipDoPedido(req))
  }

  // Nest usa 201 por padrão em @Post(); aqui não é criação de recurso — a sala já existe,
  // só está sendo consumida (mesma razão do antigo POST /api/entrar).
  @Post(':slug/entrar')
  @HttpCode(HttpStatus.OK)
  entrarNaSala(@Param('slug') slug: string, @Body() dto: EntrarSalaDto, @Req() req: Request) {
    return this.entrar.execute(slug, dto.senha, dto.seuNome, ipDoPedido(req))
  }
}
