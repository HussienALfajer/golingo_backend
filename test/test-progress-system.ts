/**
 * Test script for educational progress system
 * Run with: ts-node test/test-progress-system.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ProgressService } from '../src/modules/progress/progress.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { QuizzesService } from '../src/modules/quizzes/quizzes.service';
import { INestApplication } from '@nestjs/common';
import { UserRole } from '../src/common/enums/user-role.enum';

async function testProgressSystem() {
  const app: INestApplication = await NestFactory.create(AppModule);
  
  const progressService = app.get(ProgressService);
  const authService = app.get(AuthService);
  const quizzesService = app.get(QuizzesService);

  console.log('🧪 Testing Educational Progress System\n');

  try {
    // Test 1: New user registration should unlock first level, category, and lesson
    console.log('Test 1: New User Registration');
    const testUser = {
      email: `test${Date.now()}@example.com`,
      password: 'Test123!',
      displayName: 'Test User',
      role: UserRole.LEARNER
    };

    const authResult = await authService.register(testUser);
    const userId = authResult.user.id;
    console.log(`✅ User registered: ${testUser.email}`);

    // Check initial progress
    const levelsProgress = await progressService.getAllLevelsProgress(userId);
    console.log(`✅ Levels retrieved: ${levelsProgress.length} levels`);
    
    const firstLevel = levelsProgress[0];
    console.log(`  - Level 1 unlocked: ${firstLevel.isUnlocked}`);
    console.log(`  - Level 1 categories: ${firstLevel.progress.totalCategories}`);

    // Get first level details
    const levelDetails = await progressService.getLevelProgress(userId, (firstLevel._id as any).toString());
    const firstCategory = levelDetails.categories[0];
    console.log(`  - First category unlocked: ${firstCategory.isUnlocked}`);

    // Get first category details
    const categoryDetails = await progressService.getCategoryProgress(userId, (firstCategory._id as any).toString());
    console.log(`  - Category has ${categoryDetails.lessons.length} lessons`);
    
    if (categoryDetails.lessons.length > 0) {
      const firstLesson = categoryDetails.lessons[0];
      console.log(`  - First lesson unlocked: ${firstLesson.isUnlocked}`);
      console.log(`  - First lesson videos: ${firstLesson.progress.totalVideos}`);
    }

    // Test 2: Watching videos in a lesson
    console.log('\nTest 2: Watching Lesson Videos');
    if (categoryDetails.lessons.length > 0) {
      const firstLesson = categoryDetails.lessons[0];
      
      // Watch all videos in the first lesson
      const lessonVideos = (firstLesson as any).videos || [];
      for (const video of lessonVideos.filter((v: any) => v.isForLesson)) {
        await progressService.markLessonVideoWatched(
          userId,
          (firstLesson._id as any).toString(),
          video.videoId
        );
        console.log(`  ✅ Watched video: ${video.videoId}`);
      }

      // Check if lesson is completed and next lesson is unlocked
      const updatedCategory = await progressService.getCategoryProgress(userId, (firstCategory._id as any).toString());
      const updatedFirstLesson = updatedCategory.lessons[0];
      console.log(`  - First lesson completed: ${updatedFirstLesson.isCompleted}`);
      
      if (updatedCategory.lessons.length > 1) {
        const secondLesson = updatedCategory.lessons[1];
        console.log(`  - Second lesson unlocked: ${secondLesson.isUnlocked}`);
      }
    }

    // Test 3: Quiz completion
    console.log('\nTest 3: Category Quiz Completion');
    
    // Find category quiz
    const categoryQuiz = await quizzesService.findByCategory((firstCategory._id as any).toString());
    if (categoryQuiz) {
      console.log(`  - Found category quiz: ${categoryQuiz._id}`);
      
      // Simulate quiz submission with 60% score
      const quizSubmission = {
        quizId: (categoryQuiz._id as any).toString(),
        answers: categoryQuiz.questions.map((q: any, index: number) => ({
          questionId: q.questionId,
          // Simulate correct answers for 60% of questions
          selectedOptionIds: index < categoryQuiz.questions.length * 0.6 
            ? q.correctOptionIds 
            : ['wrong_answer']
        }))
      };

      const attempt = await quizzesService.submitQuiz(userId, quizSubmission);
      console.log(`  - Quiz score: ${attempt.score}%`);
      console.log(`  - Quiz passed: ${attempt.passed}`);

      // Update category progress
      await progressService.updateCategoryProgressAfterQuiz(userId, (firstCategory._id as any).toString());
      
      // Check if next category is unlocked
      const updatedLevel = await progressService.getLevelProgress(userId, (firstLevel._id as any).toString());
      if (updatedLevel.categories.length > 1) {
        const secondCategory = updatedLevel.categories[1];
        console.log(`  - Second category unlocked: ${secondCategory.isUnlocked}`);
      }
    } else {
      console.log('  ⚠️  No quiz found for this category');
    }

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await app.close();
  }
}

// Run the test
testProgressSystem()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
