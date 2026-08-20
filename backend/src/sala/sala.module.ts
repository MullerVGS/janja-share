import { Module } from '@nestjs/common'
import { LivekitRoomProvider } from '../shared/livekit/livekit-room.provider'
import { AdminSalaController } from './controllers/admin-sala.controller'

@Module({
  controllers: [AdminSalaController],
  providers: [LivekitRoomProvider],
})
export class SalaModule {}
