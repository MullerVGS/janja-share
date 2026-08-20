import { Controller, Get } from '@nestjs/common'
import { env } from '../shared/env'

@Controller('config')
export class ConfigController {
  @Get()
  obter() {
    const { livekitUrl } = env()
    return { urlSfu: livekitUrl }
  }
}
