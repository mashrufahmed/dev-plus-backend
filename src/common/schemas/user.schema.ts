import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ type: String, unique: true })
  github_id!: string;

  @Prop({ type: String })
  github_username!: string;

  @Prop({ type: String })
  name!: string;

  @Prop({ type: String, required: false })
  avatar_url?: string;

  @Prop({ type: String, required: true })
  email!: string;

  @Prop({ type: String, required: true })
  github_access_token!: string;

  @Prop({ type: Date, required: false })
  last_login_at?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
