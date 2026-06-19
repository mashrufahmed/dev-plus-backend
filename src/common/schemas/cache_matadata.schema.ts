import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CacheMetadataDocument = HydratedDocument<CacheMetadata>;

@Schema({ timestamps: true })
export class CacheMetadata {
  @Prop({ type: String, required: true })
  github_username!: string;

  @Prop({ type: Date, required: true })
  last_cached_at!: Date;

  @Prop({ type: Number, default: 1 })
  cache_version?: number;
}

export const CacheMetadataSchema = SchemaFactory.createForClass(CacheMetadata);
