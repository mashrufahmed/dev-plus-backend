import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import { AuthService } from '../auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow('GITHUB_CLIENT_ID'),
      clientSecret: configService.getOrThrow('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow('GITHUB_CALLBACK_URL'),
      scope: ['user:email', 'read:user'],
    });
  }
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: Function,
  ) {
    const { emails, displayName, photos } = profile;
    const { user } = await this.authService.validateSocialUser({
      github_id: profile.id,
      access_token: accessToken,
      github_username: profile.username || '',
      email: emails?.[0].value || '',
      name: displayName ?? profile.username?.replaceAll('-', ' '),
      avatar: photos?.[0].value,
    });
    done(null, user);
  }
}
