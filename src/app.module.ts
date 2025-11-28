/**
 * Application Root Module
 * Main module that imports all feature modules and configures the application
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule as AppConfigModule } from './config/config.module';

// Feature Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LevelsModule } from './modules/levels/levels.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { VideosModule } from './modules/videos/videos.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { ProgressModule } from './modules/progress/progress.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MediaModule } from './modules/media/media.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { GamifyModule } from './modules/gamify/gamify.module';

// Services for initialization
import { AchievementsService } from './modules/achievements/achievements.service';
import { ProgressService } from './modules/progress/progress.service';
import { ShopService } from './modules/gamify/shop.service';
import { LeagueService } from './modules/gamify/services/league.service';
import { QuestService } from './modules/gamify/services/quest.service';
import { MilestoneService } from './modules/gamify/services/milestone.service';

@Module({
  imports: [
    // Configuration
    AppConfigModule,

    // Event Emitter
    EventEmitterModule.forRoot(),

    // MongoDB Connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
      }),
      inject: [ConfigService],
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60, // Time window in seconds
        limit: 100, // Maximum number of requests per window
      },
    ]),

    // Feature Modules
    AuthModule,
    UsersModule,
    LevelsModule,
    CategoriesModule,
    VideosModule,
    QuizzesModule,
    ProgressModule,
    AchievementsModule,
    NotificationsModule,
    MediaModule,
    LessonsModule,
    GamifyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly achievementsService: AchievementsService,
    private readonly progressService: ProgressService,
    private readonly shopService: ShopService,
    private readonly leagueService: LeagueService,
    private readonly questService: QuestService,
    private readonly milestoneService: MilestoneService,
  ) {}

  /**
   * Initialize default data when the module is loaded
   */
  async onModuleInit() {
    // Initialize default achievements
    try {
      await this.achievementsService.initializeDefaultAchievements();
      console.log('Default achievements initialized');
    } catch (error) {
      console.error('Error initializing achievements:', error);
    }

    // Initialize default shop items
    try {
      await this.shopService.initializeDefaultItems();
      console.log('Default shop items initialized');
    } catch (error) {
      console.error('Error initializing shop items:', error);
    }

    // Initialize default leagues
    try {
      await this.leagueService.initializeDefaultLeagues();
      console.log('Default leagues initialized');
    } catch (error) {
      console.error('Error initializing leagues:', error);
    }

    // Initialize default quest templates
    try {
      await this.questService.initializeDefaultTemplates();
      console.log('Default quest templates initialized');
    } catch (error) {
      console.error('Error initializing quest templates:', error);
    }

    // Initialize default streak milestones
    try {
      await this.milestoneService.initializeDefaultMilestones();
      console.log('Default streak milestones initialized');
    } catch (error) {
      console.error('Error initializing streak milestones:', error);
    }
  }
}
