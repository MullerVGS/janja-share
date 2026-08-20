import { Controller, Get, UseGuards } from '@nestjs/common'
import { AdminHostGuard } from '../../admin/admin-host.guard'
import { LivekitRoomProvider, ParticipanteSala } from '../../shared/livekit/livekit-room.provider'

@UseGuards(AdminHostGuard)
@Controller('admin/sala')
export class AdminSalaController {
  constructor(private readonly sala: LivekitRoomProvider) {}

  @Get()
  async participantes(): Promise<{ participantes: ParticipanteSala[] }> {
    return { participantes: await this.sala.participantes() }
  }
}
