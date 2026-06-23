import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    const redisUri = configService.getOrThrow<String>('REDIS_URI');
    this.client = new Redis(redisUri as string);
  }

  async set(key: string, value: string, TTL: number) {
    return await this.client.set(key, value, 'EX', TTL);
  }

  async get(key: string) {
    return await this.client.get(key);
  }

  async del(key: string) {
    return this.client.del(key);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
