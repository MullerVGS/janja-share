import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common'
import { Request } from 'express'
import { ipDoPedido } from '../../shared/ip'
import { slugDaSala } from '../../shared/slug'
import { AjustarSalaDto } from '../dto/ajustar-sala.dto'
import { CriarSalaDto } from '../dto/criar-sala.dto'
import { EntrarSalaDto } from '../dto/entrar-sala.dto'
import { AjustarSalaUseCase } from '../useCases/ajustarSala/AjustarSalaUseCase'
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
    private readonly ajustar: AjustarSalaUseCase,
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
      privada: dto.privada,
      fixa: dto.fixa,
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
    return this.entrar.execute({
      slug: slugDaSala(slugBruto),
      seuNome: dto.seuNome,
      assinatura: dto.assinatura,
      ip: ipDoPedido(req),
    })
  }

  // Nome e visibilidade depois de criar. O token do LiveKit vai no Authorization: é ele que
  // diz em qual encarnação a pessoa está, e o use case confere que ela está lá dentro agora.
  @Patch(':slug')
  ajustarSala(
    @Param('slug') slugBruto: string,
    @Body() dto: AjustarSalaDto,
    @Headers('authorization') autorizacao: string | undefined,
    @Req() req: Request,
  ) {
    const token = autorizacao?.startsWith('Bearer ') ? autorizacao.slice('Bearer '.length).trim() : null
    return this.ajustar.execute({
      slug: slugDaSala(slugBruto),
      token,
      nome: dto.nome,
      privada: dto.privada,
      ip: ipDoPedido(req),
    })
  }
}
