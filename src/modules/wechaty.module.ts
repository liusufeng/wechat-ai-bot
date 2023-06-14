import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { TypeOrmModule } from '@nestjs/typeorm'
import { WechatyService } from '../services/wechaty.service'
import { ChatSession } from '../entities/chat_session.entity'
import { ChatContext } from '../entities/chat_context.entity'
import { ChatImage } from '../entities/chat_image.entity'

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([ChatSession, ChatContext, ChatImage])
  ],
  controllers: [],
  providers: [WechatyService]
})
export class WechatyModule {}
