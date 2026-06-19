import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CacheMetadata,
  CacheMetadataSchema,
} from 'src/common/schemas/cache_matadata.schema';
import {
  CompareHistory,
  CompareHistorySchema,
} from 'src/common/schemas/compare_history.schema';
import {
  ProfileSetting,
  ProfileSettingSchema,
} from 'src/common/schemas/profile-setting.schema';
import { User, UserSchema } from 'src/common/schemas/user.schema';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ProfileSetting.name, schema: ProfileSettingSchema },
      { name: CompareHistory.name, schema: CompareHistorySchema },
      { name: CacheMetadata.name, schema: CacheMetadataSchema },
    ]),
  ],
  controllers: [GithubController],
  providers: [GithubService],
})
export class GithubModule {}
