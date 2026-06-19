import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProfileSetting } from 'src/common/schemas/profile-setting.schema';
import { User } from 'src/common/schemas/user.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(ProfileSetting.name)
    private readonly profileSettingModel: Model<ProfileSetting>,
  ) {}

  private sanitizeUser(user: any) {
    if (!user) {
      return null;
    }

    const plainUser = typeof user.toObject === 'function' ? user.toObject() : user;
    const { github_access_token, __v, ...rest } = plainUser;
    return rest;
  }

  private async getProfileSetting(userId: string) {
    const profile = await this.profileSettingModel.findOne({ user: userId });

    if (!profile) {
      throw new NotFoundException('Profile settings not found');
    }

    return profile;
  }

  async getMe(userId: string) {
    const profile = await this.profileSettingModel
      .findOne({ user: userId })
      .populate('user');

    if (!profile) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'User found',
      success: true,
      data: {
        user: this.sanitizeUser(profile.user),
        settings: {
          _id: profile._id,
          show_languages: profile.show_languages,
          show_streak: profile.show_streak,
          show_repos: profile.show_repos,
          show_activity: profile.show_activity,
          public_profile: profile.public_profile,
        },
      },
    };
  }

  async getSettings(userId: string) {
    const profile = await this.getProfileSetting(userId);

    return {
      success: true,
      data: {
        _id: profile._id,
        show_languages: profile.show_languages,
        show_streak: profile.show_streak,
        show_repos: profile.show_repos,
        show_activity: profile.show_activity,
        public_profile: profile.public_profile,
      },
    };
  }

  async updateSettings(userId: string, body: Record<string, boolean>) {
    const profile = await this.getProfileSetting(userId);

    profile.show_languages = body.show_languages ?? profile.show_languages;
    profile.show_streak = body.show_streak ?? profile.show_streak;
    profile.show_repos = body.show_repos ?? profile.show_repos;
    profile.show_activity = body.show_activity ?? profile.show_activity;
    profile.public_profile = body.public_profile ?? profile.public_profile;

    await profile.save();

    return {
      success: true,
      message: 'Settings updated successfully',
      data: {
        _id: profile._id,
        show_languages: profile.show_languages,
        show_streak: profile.show_streak,
        show_repos: profile.show_repos,
        show_activity: profile.show_activity,
        public_profile: profile.public_profile,
      },
    };
  }

  async deleteAccount(userId: string) {
    await this.profileSettingModel.findOneAndDelete({ user: userId });
    await this.userModel.findByIdAndDelete(userId);

    return {
      success: true,
      message: 'Account deleted successfully',
    };
  }
}
