import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common'
import { AdminHostGuard } from '../../admin/admin-host.guard'
import { CriarConviteDto } from '../dto/criar-convite.dto'
import { CriarConviteUseCase } from '../useCases/criarConvite/CriarConviteUseCase'
import { ListarConvitesUseCase } from '../useCases/listarConvites/ListarConvitesUseCase'
import { RevogarConviteUseCase } from '../useCases/revogarConvite/RevogarConviteUseCase'

@UseGuards(AdminHostGuard)
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
