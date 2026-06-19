import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from 'src/common/jwt/jwt.guard';
import { UserDocument } from 'src/common/schemas/user.schema';
import { GithubService } from './github.service';

@Controller()
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @UseGuards(JwtAuthGuard)
  @Get('dashboard/overview')
  getDashboardOverview(@Req() req: Request) {
    const user = req.user as UserDocument;
    return this.githubService.getDashboardOverview(String(user._id));
  }

  @UseGuards(JwtAuthGuard)
  @Get('dashboard/contribution-chart')
  getContributionChart(@Req() req: Request) {
    const user = req.user as UserDocument;
    return this.githubService.getContributionChart(String(user._id));
  }

  @UseGuards(JwtAuthGuard)
  @Get('dashboard/monthly-trend')
  getMonthlyTrend(@Req() req: Request) {
    const user = req.user as UserDocument;
    return this.githubService.getMonthlyTrend(String(user._id));
  }

  @Get('profile/:username')
  getPublicProfile(@Param('username') username: string) {
    return this.githubService.getPublicProfile(username);
  }

  @Get('profile/:username/languages')
  getLanguages(@Param('username') username: string) {
    return this.githubService.getPublicLanguages(username);
  }

  @Get('profile/:username/streak')
  getStreak(@Param('username') username: string) {
    return this.githubService.getPublicStreak(username);
  }

  @Get('profile/:username/repos')
  getRepositories(@Param('username') username: string) {
    return this.githubService.getPublicRepositories(username);
  }

  @Get('profile/:username/activity')
  getActivity(@Param('username') username: string) {
    return this.githubService.getPublicActivity(username);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile/refresh')
  refreshProfile(@Req() req: Request) {
    const user = req.user as UserDocument;
    return this.githubService.refreshProfile(String(user._id));
  }

  @Get('compare')
  compareUsers(@Query('a') userA: string, @Query('b') userB: string) {
    return this.githubService.compareUsers(userA, userB);
  }

  @UseGuards(JwtAuthGuard)
  @Get('compare/history')
  getCompareHistory(@Req() req: Request) {
    const user = req.user as UserDocument;
    return this.githubService.getCompareHistory(String(user._id));
  }
}
