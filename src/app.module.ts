import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { WechatyModule } from './modules/wechaty.module'
import configs from './configs'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: configs.MYSQL_HOST,
      port: configs.MYSQL_PORT,
      username: configs.MYSQL_USERNAME,
      password: configs.MYSQL_PASSWORD,
      database: configs.MYSQL_DATABASE,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      retryDelay: 500,
      retryAttempts: 10,
      autoLoadEntities: true
    }),
    WechatyModule
  ],
  controllers: [],
  providers: [],
  exports: []
})
export class AppModule {}
