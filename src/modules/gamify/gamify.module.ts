/**
 * Gamify Module
 * Module for gamification features (XP, energy, streak, gems, achievements, shop, leagues, quests, mastery)
 */

import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GamifyService } from './gamify.service';
import { ShopService } from './shop.service';
import { LeagueService } from './services/league.service';
import { StreakService } from './services/streak.service';
import { HeartsService } from './services/hearts.service';
import { QuestService } from './services/quest.service';
import { MasteryService } from './services/mastery.service';
import { MilestoneService } from './services/milestone.service';
import { GamifyController, PathController } from './gamify.controller';
import { ShopController } from './shop.controller';
import { LeagueController } from './controllers/league.controller';
import { QuestController } from './controllers/quest.controller';
import { MasteryController } from './controllers/mastery.controller';
import { FriendsController } from './controllers/friends.controller';
import { MilestoneController } from './controllers/milestone.controller';
import { UserStats, UserStatsSchema } from './schemas/user-stats.schema';
import { ShopItem, ShopItemSchema } from './schemas/shop-item.schema';
import { Purchase, PurchaseSchema } from './schemas/purchase.schema';
import { League, LeagueSchema } from './schemas/league.schema';
import {
  LeagueSession,
  LeagueSessionSchema,
} from './schemas/league-session.schema';
import {
  LeagueParticipant,
  LeagueParticipantSchema,
} from './schemas/league-participant.schema';
import {
  SkillProgress,
  SkillProgressSchema,
} from './schemas/skill-progress.schema';
import {
  DailyQuest,
  DailyQuestSchema,
} from './schemas/daily-quest.schema';
import {
  QuestTemplate,
  QuestTemplateSchema,
} from './schemas/quest-template.schema';
import {
  Friendship,
  FriendshipSchema,
} from './schemas/friendship.schema';
import {
  FriendQuest,
  FriendQuestSchema,
} from './schemas/friend-quest.schema';
import {
  AchievementShare,
  AchievementShareSchema,
} from './schemas/achievement-share.schema';
import {
  StreakMilestone,
  StreakMilestoneSchema,
} from './schemas/streak-milestone.schema';
import { AchievementsModule } from '../achievements/achievements.module';
import { LevelsModule } from '../levels/levels.module';
import { CategoriesModule } from '../categories/categories.module';
import { ProgressModule } from '../progress/progress.module';
import { QuizzesModule } from '../quizzes/quizzes.module';
import { AuthModule } from '../auth/auth.module';
import {
  CategoryProgress,
  CategoryProgressSchema,
} from '../progress/schemas/category-progress.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserStats.name, schema: UserStatsSchema },
      { name: ShopItem.name, schema: ShopItemSchema },
      { name: Purchase.name, schema: PurchaseSchema },
      { name: League.name, schema: LeagueSchema },
      { name: LeagueSession.name, schema: LeagueSessionSchema },
      { name: LeagueParticipant.name, schema: LeagueParticipantSchema },
      { name: SkillProgress.name, schema: SkillProgressSchema },
      { name: DailyQuest.name, schema: DailyQuestSchema },
      { name: QuestTemplate.name, schema: QuestTemplateSchema },
      { name: Friendship.name, schema: FriendshipSchema },
      { name: FriendQuest.name, schema: FriendQuestSchema },
      { name: AchievementShare.name, schema: AchievementShareSchema },
      { name: CategoryProgress.name, schema: CategoryProgressSchema },
      { name: StreakMilestone.name, schema: StreakMilestoneSchema },
    ]),
    AchievementsModule,
    forwardRef(() => LevelsModule),
    forwardRef(() => CategoriesModule),
    forwardRef(() => ProgressModule),
    forwardRef(() => QuizzesModule),
    AuthModule,
  ],
  controllers: [
    GamifyController,
    ShopController,
    PathController,
    LeagueController,
    QuestController,
    MasteryController,
    FriendsController,
    MilestoneController,
  ],
  providers: [
    GamifyService,
    ShopService,
    LeagueService,
    StreakService,
    HeartsService,
    QuestService,
    MasteryService,
    MilestoneService,
  ],
  exports: [
    GamifyService,
    ShopService,
    LeagueService,
    StreakService,
    HeartsService,
    QuestService,
    MasteryService,
    MilestoneService,
  ],
})
export class GamifyModule {}
