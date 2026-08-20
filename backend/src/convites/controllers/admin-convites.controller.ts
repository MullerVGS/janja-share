import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { CriarConviteDto } from '../dto/criar-convite.dto'
import { CriarConviteUseCase } from '../useCases/criarConvite/CriarConviteUseCase'
import { ListarConvitesUseCase } from '../useCases/listarConvites/ListarConvitesUseCase'
import { RevogarConviteUseCase } from '../useCases/revogarConvite/RevogarConviteUseCase'

// Sem @UseGuards aqui: a guarda de Host é global (AdminHostGuard via APP_GUARD em
// app.module.ts) e se aplica pelo caminho /api/admin/*, não por decorator neste controller.
@Controller('admin/convites')
export class AdminConvitesController {
  constructor(
    private readonly listar: ListarConvitesUseCase,
    private readonly criar: CriarConviteUseCase,
    private readonly revogar: RevogarConviteUseCase,
  ) {}

  @Get()
  listarConvites() {
    return this.listar.execute()
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  criarConvite(@Body() dto: CriarConviteDto) {
    return this.criar.execute(dto.rotulo, dto.validadeHoras, dto.usosMax)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revogarConvite(@Param('id') id: string): Promise<void> {
    await this.revogar.execute(id)
  }
}
