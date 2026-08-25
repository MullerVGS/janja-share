import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common'
import { Request } from 'express'
import { ipDoPedido } from '../../shared/ip'
import { slugDaSala } from '../../shared/slug'
import { CriarSalaDto } from '../dto/criar-sala.dto'
import { EntrarSalaDto } from '../dto/entrar-sala.dto'
import { CriarSalaUseCase } from '../useCases/criarSala/CriarSalaUseCase'
import { EntrarNaSalaUseCase } from '../useCases/entrarNaSala/EntrarNaSalaUseCase'
import { ListarSalasUseCase } from '../useCases/listarSalas/ListarSalasUseCase'
import { SugerirNomeDeSalaUseCase } from '../useCases/sugerirNomeDeSala/SugerirNomeDeSalaUseCase'

@Controller('salas')
export class SalasController {
  constructor(
    private readonly listar: ListarSalasUseCase,
    private readonly sugerirNome: SugerirNomeDeSalaUseCase,
    private readonly criar: CriarSalaUseCase,
    private readonly entrar: EntrarNaSalaUseCase,
  ) {}

  @Get()
  listarSalas() {
    return this.listar.execute()
  }

  @Get('nome-sugerido')
  sugerirNomeDaSala(@Query('nomeAtual') nomeAtual: unknown) {
    return this.sugerirNome.execute(nomeAtual)
  }

  // 201 padrão do Nest: diferente de entrar, aqui a sala é criada de verdade no SFU.
  @Post()
  criarSala(@Body() dto: CriarSalaDto, @Req() req: Request) {
    return this.criar.execute({
      nome: dto.nome,
      senha: dto.senha,
      privada: dto.privada,
      seuNome: dto.seuNome,
      ip: ipDoPedido(req),
    })
  }

  // Nest usa 201 por padrão em @Post(); aqui não é criação de recurso — a sala já existe,
  // só está sendo consumida (mesma razão do antigo POST /api/entrar).
  //
  // O :slug da URL passa por slugDaSala antes de usar: sem isso, "Jogatina" (maiúscula) daria
  // 404 mesmo com a sala "jogatina" viva — o mesmo nome que create/listagem tratam como uma
  // coisa só.
  @Post(':slug/entrar')
  @HttpCode(HttpStatus.OK)
  entrarNaSala(@Param('slug') slugBruto: string, @Body() dto: EntrarSalaDto, @Req() req: Request) {
    return this.entrar.execute(slugDaSala(slugBruto), dto.senha, dto.seuNome, ipDoPedido(req))
  }
}
