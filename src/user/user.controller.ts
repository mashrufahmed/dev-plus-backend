import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from 'src/common/jwt/jwt.guard';
import { UserDocument } from 'src/common/schemas/user.schema';
import { UserService } from './user.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('user/me')
  getMe(@Req() req: Request) {
    const user = req.user as UserDocument;
    return this.userService.getMe(String(user._id));
  }

  @Get('settings')
  getSettings(@Req() req: Request) {
    const user = req.user as UserDocument;
    return this.userService.getSettings(String(user._id));
  }

  @Patch('settings')
  updateSettings(@Req() req: Request, @Body() body: Record<string, boolean>) {
    const user = req.user as UserDocument;
    return this.userService.updateSettings(String(user._id), body);
  }

  @Delete('settings/account')
  deleteAccount(@Req() req: Request) {
    const user = req.user as UserDocument;
    return this.userService.deleteAccount(String(user._id));
  }
}
