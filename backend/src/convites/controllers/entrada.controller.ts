import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { EntrarDto } from '../dto/entrar.dto'
import { EntrarUseCase } from '../useCases/entrar/EntrarUseCase'
import { VerificarConviteUseCase } from '../useCases/verificarConvite/VerificarConviteUseCase'

/** Fluxo público de entrada: precheck do convite e emissão do token do LiveKit. */
@Controller()
export class EntradaController {
  constructor(
    private readonly verificar: VerificarConviteUseCase,
    private readonly entrar: EntrarUseCase,
  ) {}

  @Get('convites/:token')
  async verificarConvite(@Param('token') token: string) {
    const { rotulo } = await this.verificar.execute(token)
    return { valido: true, rotulo }
  }

  // Nest usa 201 por padrão em @Post(); o contrato pede 200 aqui (não é criação de recurso,
  // o "recurso" já existia — o convite só está sendo consumido).
  @Post('entrar')
  @HttpCode(HttpStatus.OK)
  entrarNaSala(@Body() dto: EntrarDto) {
    return this.entrar.execute(dto.convite, dto.nome)
  }
}
