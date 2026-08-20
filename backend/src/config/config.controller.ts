import { Controller, Get } from '@nestjs/common'
import { env } from '../shared/env'

@Controller('config')
export class ConfigController {
  @Get()
  obter() {
    const { livekitUrl, sala } = env()
    return { urlSfu: livekitUrl, sala }
  }
}
