import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { User } from './user.schema';

export type CompareHistoryDocument = HydratedDocument<CompareHistory>;

@Schema({ timestamps: true })
export class CompareHistory {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: false,
  })
  user?: mongoose.Types.ObjectId;

  @Prop({ type: String, required: true })
  username_a!: string;

  @Prop({ type: String, required: true })
  username_b!: string;
}

export const CompareHistorySchema =
  SchemaFactory.createForClass(CompareHistory);
