/**
 * Gamification Events
 * Event types for gamification system
 */

export enum GamificationEventType {
  XP_GAINED = 'xp.gained',
  LESSON_COMPLETED = 'lesson.completed',
  STREAK_MAINTAINED = 'streak.maintained',
  STREAK_BROKEN = 'streak.broken',
  HEART_LOST = 'heart.lost',
  HEART_GAINED = 'heart.gained',
  ACHIEVEMENT_UNLOCKED = 'achievement.unlocked',
  LEAGUE_PROMOTED = 'league.promoted',
  LEAGUE_DEMOTED = 'league.demoted',
  CROWN_LEVELED_UP = 'crown.leveled_up',
  QUEST_COMPLETED = 'quest.completed',
  FRIEND_ADDED = 'friend.added',
  DAILY_GOAL_REACHED = 'daily.goal_reached',
}

export interface XPGainedEvent {
  userId: string;
  xpAmount: number;
  source: string; // 'lesson', 'quiz', 'practice', 'quest'
  metadata?: Record<string, any>;
}

export interface LessonCompletedEvent {
  userId: string;
  lessonId: string;
  categoryId: string;
  xpGained: number;
  passed: boolean;
  score?: number;
}

export interface StreakMaintainedEvent {
  userId: string;
  currentStreak: number;
  bestStreak: number;
}

export interface StreakBrokenEvent {
  userId: string;
  previousStreak: number;
}

export interface HeartLostEvent {
  userId: string;
  heartsRemaining: number;
  reason: string;
}

export interface HeartGainedEvent {
  userId: string;
  heartsRemaining: number;
  source: string;
}

export interface AchievementUnlockedEvent {
  userId: string;
  achievementId: string;
  achievementCode: string;
  tier?: string;
  xpReward?: number;
  gemReward?: number;
}

export interface LeaguePromotedEvent {
  userId: string;
  fromLeague: string;
  toLeague: string;
  rank: number;
}

export interface LeagueDemotedEvent {
  userId: string;
  fromLeague: string;
  toLeague: string;
  rank: number;
}

export interface CrownLeveledUpEvent {
  userId: string;
  skillId: string;
  fromLevel: number;
  toLevel: number;
  xpReward: number;
}

export interface QuestCompletedEvent {
  userId: string;
  questId: string;
  questType: string;
  reward: number;
}

export interface FriendAddedEvent {
  userId: string;
  friendId: string;
}

export interface DailyGoalReachedEvent {
  userId: string;
  dailyGoalXP: number;
  reward: number;
}

