import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { WechatyService } from './services/wechaty.service'

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule)

  // 设置swagger文档相关配置
  const swaggerOption = new DocumentBuilder()
    .setTitle('接口文档')
    .setDescription('nestjs接口文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, swaggerOption)
  SwaggerModule.setup('doc', app, document)

  const server = await app.listen(8080)

  return { app, server }
}

bootstrap().then(({ app, server }) => {
  const address = server.address()
  const host = address.address === '::' ? '127.0.0.1' : address.address
  const port = address.port

  console.log(`启动成功！访问地址：http://${host}:${port}`)

  // 启动微信机器人
  startWechatyBot(app.get(WechatyService))
})

function startWechatyBot(wechatyService: WechatyService) {
  console.log('正在启动微信机器人...')
  wechatyService
    .start()
    .then(() => {
      console.log('微信机器人启动成功！')
    })
    .catch((e) => {
      console.error('微信机器人启动失败！', e)
    })
}
