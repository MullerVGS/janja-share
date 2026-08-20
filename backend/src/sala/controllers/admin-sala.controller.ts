import { Controller, Get } from '@nestjs/common'
import { LivekitRoomProvider, ParticipanteSala } from '../../shared/livekit/livekit-room.provider'

// Sem @UseGuards aqui: a guarda de Host é global (AdminHostGuard via APP_GUARD em
// app.module.ts) e se aplica pelo caminho /api/admin/*, não por decorator neste controller.
@Controller('admin/sala')
export class AdminSalaController {
  constructor(private readonly sala: LivekitRoomProvider) {}

  @Get()
  async participantes(): Promise<{ participantes: ParticipanteSala[] }> {
    return { participantes: await this.sala.participantes() }
  }
}
