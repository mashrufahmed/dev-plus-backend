import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');
        const dbName = configService.get<string>('MONGODB_DATABASE');
        if (!uri) {
          throw new Error('MONGODB_URI is not defined');
        }

        return {
          uri,
          dbName,
          autoIndex: true,
          retryWrites: true,
          maxPoolSize: 10,
        };
      },
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
