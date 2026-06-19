import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from 'src/common/jwt/jwt.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('github')
  @UseGuards(PassportAuthGuard('github'))
  githubLogin() {}

  @Get('callback/github')
  @UseGuards(PassportAuthGuard('github'))
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    return this.authService.loginUser(req, res);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res);
  }
}

