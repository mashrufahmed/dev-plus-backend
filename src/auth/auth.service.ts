import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import type { Request, Response } from 'express';
import { Model } from 'mongoose';
import { StringValue } from 'ms';
import { ProfileSetting } from 'src/common/schemas/profile-setting.schema';
import { User, UserDocument } from 'src/common/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(ProfileSetting.name)
    private readonly profileSettingModel: Model<ProfileSetting>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async validateSocialUser(data: {
    github_id: string;
    github_username: string;
    access_token: string;
    email: string;
    name: string;
    avatar?: string;
  }) {
    let existingUser = await this.userModel.findOne({
      $or: [{ github_id: data.github_id }, { github_username: data.github_username }],
    });

    if (existingUser) {
      existingUser = await this.userModel.findOneAndUpdate(
        { _id: existingUser._id },
        {
          github_id: data.github_id,
          github_access_token: data.access_token,
          github_username: data.github_username,
          name: data.name,
          avatar_url: data.avatar,
          last_login_at: new Date(),
        },
        { new: true },
      );

      return { user: existingUser };
    }

    const newUser = await this.userModel.create({
      github_id: data.github_id,
      github_username: data.github_username,
      name: data.name,
      avatar_url: data.avatar,
      github_access_token: data.access_token,
      email: data.email,
    });

    await this.profileSettingModel.create({
      user: newUser._id,
    });

    return { user: newUser };
  }

  async loginUser(req: Request, res: Response) {
    const redirectUrl = this.configService.getOrThrow('FRONTEND_URL');
    const user = req.user as UserDocument;

    const secret = this.configService.get<string>('JWT_SECRET');
    const expiresIn = this.configService.get<StringValue>('JWT_EXPIRES_IN');
    const payload = { sub: user._id };

    const token = this.jwtService.sign(payload, {
      secret: secret,
      expiresIn: expiresIn,
    });
    const isProd = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? ('none' as const) : ('lax' as const),
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie('d_t-secure', token, cookieOptions);

    return res.redirect(`${redirectUrl}/auth/callback`);
  }

  async logout(res: Response) {
    const isProd = process.env.NODE_ENV === 'production';

    res.clearCookie('d_t-secure', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    });
    return {
      message: 'Logged out successfully',
      success: true,
    };
  }

  async findUser(userId: string) {
    return await this.userModel.findById(userId);
  }
}
