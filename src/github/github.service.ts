import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Octokit } from 'octokit';
import { CacheMetadata } from 'src/common/schemas/cache_matadata.schema';
import { CompareHistory } from 'src/common/schemas/compare_history.schema';
import { ProfileSetting } from 'src/common/schemas/profile-setting.schema';
import { User } from 'src/common/schemas/user.schema';

type GithubRepo = {
  id: number;
  name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  language: string | null;
  html_url: string;
  updated_at: string;
};

type GithubProfileBundle = {
  profile: {
    github_id: number;
    github_username: string;
    avatar_url: string;
    name: string | null;
    bio: string | null;
    location: string | null;
    company: string | null;
    blog: string | null;
    followers: number;
    following: number;
    public_repos: number;
    public_gists: number;
    profile_url: string;
    github_created_at: string;
  };
  overview: {
    totalRepos: number;
    totalStars: number;
    totalForks: number;
    followers: number;
    following: number;
    publicGists: number;
  };
  languages: Array<{ name: string; value: number }>;
  streak: {
    current: number;
    longest: number;
    totalCommitDays: number;
    lastContributed: string | null;
  };
  contributions: Array<{ week: string; commits: number }>;
  monthlyTrend: Array<{ month: string; commits: number }>;
  repositories: Array<{
    id: string;
    name: string;
    description?: string;
    stars: number;
    forks: number;
    watchers: number;
    language?: string;
    url: string;
    updatedAt: string;
  }>;
  activities: Array<{
    id: string;
    type: 'commit' | 'pr' | 'star' | 'watch';
    title: string;
    repository: string;
    timestamp: string;
    url: string;
  }>;
  settings: {
    show_languages: boolean;
    show_streak: boolean;
    show_repos: boolean;
    show_activity: boolean;
    public_profile: boolean;
  };
};

@Injectable()
export class GithubService {
  private readonly cacheTtlMs = 6 * 60 * 60 * 1000;
  private readonly profileCache = new Map<
    string,
    { expiresAt: number; data: GithubProfileBundle }
  >();

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(CacheMetadata.name)
    private readonly cacheMetadataModel: Model<CacheMetadata>,
    @InjectModel(CompareHistory.name)
    private readonly compareHistoryModel: Model<CompareHistory>,
    @InjectModel(ProfileSetting.name)
    private readonly profileSettingModel: Model<ProfileSetting>,
  ) {}

  private getClient(token?: string) {
    return token ? new Octokit({ auth: token }) : new Octokit();
  }

  private async getUserOrThrow(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async getProfileSettings(username: string) {
    const user = await this.userModel.findOne({ github_username: username });

    if (!user) {
      return {
        show_languages: true,
        show_streak: true,
        show_repos: true,
        show_activity: true,
        public_profile: true,
      };
    }

    const settings = await this.profileSettingModel.findOne({ user: user._id });

    if (!settings) {
      return {
        show_languages: true,
        show_streak: true,
        show_repos: true,
        show_activity: true,
        public_profile: true,
      };
    }

    return {
      show_languages: settings.show_languages,
      show_streak: settings.show_streak,
      show_repos: settings.show_repos ?? true,
      show_activity: settings.show_activity,
      public_profile: settings.public_profile,
    };
  }

  private async fetchUserProfile(
    username: string,
    token?: string,
  ): Promise<GithubProfileBundle['profile']> {
    const octokit = this.getClient(token);
    const { data } = await octokit.rest.users.getByUsername({ username });

    return {
      github_id: data.id,
      github_username: data.login,
      avatar_url: data.avatar_url,
      name: data.name,
      bio: data.bio,
      location: data.location,
      company: data.company,
      blog: data.blog,
      followers: data.followers,
      following: data.following,
      public_repos: data.public_repos,
      public_gists: data.public_gists,
      profile_url: data.html_url,
      github_created_at: data.created_at,
    };
  }

  private async fetchRepositories(
    username: string,
    token?: string,
  ): Promise<GithubRepo[]> {
    const octokit = this.getClient(token);
    const repos = await octokit.paginate(octokit.rest.repos.listForUser, {
      username,
      per_page: 100,
      sort: 'updated',
    });

    return repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      description: repo.description,
      stargazers_count: repo.stargazers_count ?? 0,
      forks_count: repo.forks_count ?? 0,
      watchers_count: repo.watchers_count ?? 0,
      language: repo.language ?? null,
      html_url: repo.html_url,
      updated_at: repo.updated_at ?? new Date(0).toISOString(),
    }));
  }

  private async fetchEvents(username: string, token?: string) {
    const octokit = this.getClient(token);
    const events: any[] = [];

    for (let page = 1; page <= 3; page += 1) {
      const { data } = await octokit.rest.activity.listPublicEventsForUser({
        username,
        per_page: 100,
        page,
      });

      events.push(...data);

      if (data.length < 100) {
        break;
      }
    }

    return events;
  }

  private async buildLanguageBreakdown(
    repos: GithubRepo[],
    username: string,
    token?: string,
  ) {
    const octokit = this.getClient(token);
    const totals = new Map<string, number>();

    await Promise.all(
      repos.slice(0, 20).map(async (repo) => {
        try {
          const { data } = await octokit.rest.repos.listLanguages({
            owner: username,
            repo: repo.name,
          });

          for (const [language, bytes] of Object.entries(data)) {
            totals.set(language, (totals.get(language) ?? 0) + Number(bytes));
          }
        } catch {
          return null;
        }
      }),
    );

    const totalBytes = Array.from(totals.values()).reduce(
      (sum, value) => sum + value,
      0,
    );

    if (totalBytes === 0) {
      return [];
    }

    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, bytes]) => ({
        name,
        value: Number(((bytes / totalBytes) * 100).toFixed(1)),
      }));
  }

  private buildActivities(events: any[]) {
    return events.slice(0, 20).map((event) => {
      const repoName = event.repo?.name ?? 'Unknown repository';
      const repoUrl = `https://github.com/${repoName}`;
      const createdAt = new Date(event.created_at);
      const timestamp = createdAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      if (event.type === 'PushEvent') {
        return {
          id: event.id,
          type: 'commit' as const,
          title:
            event.payload?.commits?.[0]?.message ??
            `${event.payload?.size ?? 0} commit(s) pushed`,
          repository: repoName,
          timestamp,
          url: repoUrl,
        };
      }

      if (event.type === 'PullRequestEvent') {
        return {
          id: event.id,
          type: 'pr' as const,
          title: event.payload?.pull_request?.title ?? 'Opened a pull request',
          repository: repoName,
          timestamp,
          url: event.payload?.pull_request?.html_url ?? repoUrl,
        };
      }

      if (event.type === 'WatchEvent') {
        return {
          id: event.id,
          type: 'star' as const,
          title: 'Starred this repository',
          repository: repoName,
          timestamp,
          url: repoUrl,
        };
      }

      return {
        id: event.id,
        type: 'watch' as const,
        title: event.type.replace(/Event$/, ''),
        repository: repoName,
        timestamp,
        url: repoUrl,
      };
    });
  }

  private buildContributionSeries(events: any[]) {
    const weekly = new Map<string, number>();

    for (let offset = 11; offset >= 0; offset -= 1) {
      const startOfWeek = new Date();
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() - offset * 7);
      const key = `${startOfWeek.getFullYear()}-${startOfWeek.getMonth() + 1}-${startOfWeek.getDate()}`;
      weekly.set(key, 0);
    }

    for (const event of events) {
      const commits =
        event.type === 'PushEvent'
          ? Number(event.payload?.size ?? event.payload?.commits?.length ?? 0)
          : 0;

      if (!commits) {
        continue;
      }

      const eventDate = new Date(event.created_at);
      eventDate.setHours(0, 0, 0, 0);
      eventDate.setDate(eventDate.getDate() - eventDate.getDay());
      const key = `${eventDate.getFullYear()}-${eventDate.getMonth() + 1}-${eventDate.getDate()}`;

      if (weekly.has(key)) {
        weekly.set(key, (weekly.get(key) ?? 0) + commits);
      }
    }

    return Array.from(weekly.entries()).map(([key, commits], index) => ({
      week: `W${index + 1}`,
      commits,
    }));
  }

  private buildMonthlyTrend(events: any[]) {
    const monthly = new Map<string, number>();

    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - offset);
      const label = date.toLocaleDateString('en-US', { month: 'short' });
      monthly.set(label, 0);
    }

    for (const event of events) {
      if (event.type !== 'PushEvent') {
        continue;
      }

      const label = new Date(event.created_at).toLocaleDateString('en-US', {
        month: 'short',
      });

      if (monthly.has(label)) {
        monthly.set(
          label,
          (monthly.get(label) ?? 0) +
            Number(event.payload?.size ?? event.payload?.commits?.length ?? 0),
        );
      }
    }

    return Array.from(monthly.entries()).map(([month, commits]) => ({
      month,
      commits,
    }));
  }

  private buildStreak(events: any[]) {
    const commitDates = new Set<string>();

    for (const event of events) {
      if (event.type !== 'PushEvent') {
        continue;
      }

      const commits = Number(event.payload?.size ?? event.payload?.commits?.length ?? 0);

      if (!commits) {
        continue;
      }

      const date = new Date(event.created_at).toISOString().slice(0, 10);
      commitDates.add(date);
    }

    const sortedDates = Array.from(commitDates).sort();

    let longest = 0;
    let currentRun = 0;
    let previous: Date | null = null;

    for (const dateString of sortedDates) {
      const current = new Date(`${dateString}T00:00:00.000Z`);

      if (!previous) {
        currentRun = 1;
      } else {
        const diff = Math.round(
          (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24),
        );
        currentRun = diff === 1 ? currentRun + 1 : 1;
      }

      longest = Math.max(longest, currentRun);
      previous = current;
    }

    let current = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i += 1) {
      const probe = new Date(today);
      probe.setDate(today.getDate() - i);
      const key = probe.toISOString().slice(0, 10);

      if (commitDates.has(key)) {
        current += 1;
        continue;
      }

      if (i === 0) {
        continue;
      }

      break;
    }

    const lastContributed = sortedDates.length
      ? new Date(sortedDates[sortedDates.length - 1]).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

    return {
      current,
      longest,
      totalCommitDays: commitDates.size,
      lastContributed,
    };
  }

  private buildRepositorySummary(repos: GithubRepo[]) {
    return repos
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 10)
      .map((repo) => ({
        id: String(repo.id),
        name: repo.name,
        description: repo.description ?? undefined,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        watchers: repo.watchers_count,
        language: repo.language ?? undefined,
        url: repo.html_url,
        updatedAt: repo.updated_at,
      }));
  }

  private async updateCacheMetadata(username: string) {
    await this.cacheMetadataModel.findOneAndUpdate(
      { github_username: username.toLowerCase() },
      {
        github_username: username.toLowerCase(),
        last_cached_at: new Date(),
        $inc: { cache_version: 1 },
      },
      { new: true, upsert: true },
    );
  }

  private async resolveProfileBundle(
    username: string,
    token?: string,
    forceRefresh = false,
  ) {
    const normalizedUsername = username.trim().toLowerCase();

    if (!normalizedUsername) {
      throw new BadRequestException('GitHub username is required');
    }

    const cached = this.profileCache.get(normalizedUsername);

    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const profile = await this.fetchUserProfile(normalizedUsername, token);
    const repos = await this.fetchRepositories(normalizedUsername, token);
    const events = await this.fetchEvents(normalizedUsername, token);
    const settings = await this.getProfileSettings(profile.github_username);
    const languages = await this.buildLanguageBreakdown(
      repos,
      profile.github_username,
      token,
    );
    const streak = this.buildStreak(events);
    const contributions = this.buildContributionSeries(events);
    const monthlyTrend = this.buildMonthlyTrend(events);
    const repositories = this.buildRepositorySummary(repos);
    const activities = this.buildActivities(events);

    const data: GithubProfileBundle = {
      profile,
      overview: {
        totalRepos: repos.length,
        totalStars: repos.reduce((sum, repo) => sum + repo.stargazers_count, 0),
        totalForks: repos.reduce((sum, repo) => sum + repo.forks_count, 0),
        followers: profile.followers,
        following: profile.following,
        publicGists: profile.public_gists,
      },
      languages,
      streak,
      contributions,
      monthlyTrend,
      repositories,
      activities,
      settings,
    };

    this.profileCache.set(normalizedUsername, {
      expiresAt: Date.now() + this.cacheTtlMs,
      data,
    });

    await this.updateCacheMetadata(profile.github_username);

    return data;
  }

  async getDashboardOverview(userId: string) {
    const user = await this.getUserOrThrow(userId);
    const data = await this.resolveProfileBundle(
      user.github_username,
      user.github_access_token,
    );

    return {
      success: true,
      data,
    };
  }

  async getContributionChart(userId: string) {
    const user = await this.getUserOrThrow(userId);
    const data = await this.resolveProfileBundle(
      user.github_username,
      user.github_access_token,
    );

    return {
      success: true,
      data: data.contributions,
    };
  }

  async getMonthlyTrend(userId: string) {
    const user = await this.getUserOrThrow(userId);
    const data = await this.resolveProfileBundle(
      user.github_username,
      user.github_access_token,
    );

    return {
      success: true,
      data: data.monthlyTrend,
    };
  }

  async getPublicProfile(username: string) {
    const data = await this.resolveProfileBundle(username);

    if (!data.settings.public_profile) {
      throw new NotFoundException('This profile is private');
    }

    return {
      success: true,
      data,
    };
  }

  async getPublicLanguages(username: string) {
    const data = await this.getPublicProfile(username);
    return { success: true, data: data.data.languages };
  }

  async getPublicStreak(username: string) {
    const data = await this.getPublicProfile(username);
    return { success: true, data: data.data.streak };
  }

  async getPublicRepositories(username: string) {
    const data = await this.getPublicProfile(username);
    return { success: true, data: data.data.repositories };
  }

  async getPublicActivity(username: string) {
    const data = await this.getPublicProfile(username);
    return { success: true, data: data.data.activities };
  }

  async refreshProfile(userId: string) {
    const user = await this.getUserOrThrow(userId);
    const data = await this.resolveProfileBundle(
      user.github_username,
      user.github_access_token,
      true,
    );

    return {
      success: true,
      message: 'Profile refreshed successfully',
      data,
    };
  }

  async compareUsers(usernameA: string, usernameB: string) {
    if (!usernameA || !usernameB) {
      throw new BadRequestException('Both GitHub usernames are required');
    }

    const [userA, userB] = await Promise.all([
      this.resolveProfileBundle(usernameA),
      this.resolveProfileBundle(usernameB),
    ]);

    const owner = await this.userModel.findOne({
      github_username: usernameA.toLowerCase(),
    });

    if (owner) {
      await this.compareHistoryModel.create({
        user: owner._id,
        username_a: userA.profile.github_username,
        username_b: userB.profile.github_username,
      });
    }

    return {
      success: true,
      data: {
        user1: userA,
        user2: userB,
      },
    };
  }

  async getCompareHistory(userId: string) {
    const history = await this.compareHistoryModel
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10);

    return {
      success: true,
      data: history,
    };
  }
}
