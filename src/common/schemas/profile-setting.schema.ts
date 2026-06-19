import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { User } from './user.schema';

export type ProfileSettingDocument = HydratedDocument<ProfileSetting>;

@Schema({ timestamps: true })
export class ProfileSetting {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
    unique: true,
  })
  user!: mongoose.Types.ObjectId;

  @Prop({ default: true })
  show_languages!: boolean;

  @Prop({ default: true })
  show_streak!: boolean;

  @Prop({ default: true })
  show_repos?: boolean;

  @Prop({ default: true })
  show_activity!: boolean;

  @Prop({ default: true })
  public_profile!: boolean;
}

export const ProfileSettingSchema =
  SchemaFactory.createForClass(ProfileSetting);
