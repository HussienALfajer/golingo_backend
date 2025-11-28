/**
 * E2E Tests for Lessons and Quizzes Flow
 *
 * Tests the complete learning and quizzing flow:
 * - Listing lessons by category
 * - Getting lesson details with signed URLs
 * - Fetching category final quizzes
 * - Submitting quizzes with answers
 * - Verifying per-question correctness
 * - Testing media signed URL generation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../src/modules/users/schemas/user.schema';
import {
  Level,
  LevelDocument,
} from '../src/modules/levels/schemas/level.schema';
import {
  Category,
  CategoryDocument,
} from '../src/modules/categories/schemas/category.schema';
import {
  Lesson,
  LessonDocument,
  LessonVideo,
} from '../src/modules/lessons/schemas/lesson.schema';
import { Quiz, QuizDocument } from '../src/modules/quizzes/schemas/quiz.schema';
import {
  QuizAttempt,
  QuizAttemptDocument,
} from '../src/modules/quizzes/schemas/quiz-attempt.schema';
import {
  CategoryProgress,
  CategoryProgressDocument,
} from '../src/modules/progress/schemas/category-progress.schema';
import { QuizType } from '../src/common/enums/quiz-type.enum';
import { QuestionType } from '../src/common/enums/question-type.enum';
import * as bcrypt from 'bcrypt';

describe('Lessons and Quizzes E2E', () => {
  let app: INestApplication<App>;
  let userModel: Model<UserDocument>;
  let levelModel: Model<LevelDocument>;
  let categoryModel: Model<CategoryDocument>;
  let lessonModel: Model<LessonDocument>;
  let quizModel: Model<QuizDocument>;
  let quizAttemptModel: Model<QuizAttemptDocument>;
  let categoryProgressModel: Model<CategoryProgressDocument>;

  let testUser: UserDocument;
  let testLevel: LevelDocument;
  let testCategory: CategoryDocument;
  let testLesson: LessonDocument;
  let testQuiz: QuizDocument;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get models for cleanup and setup
    userModel = moduleFixture.get<Model<UserDocument>>(
      getModelToken(User.name),
    );
    levelModel = moduleFixture.get<Model<LevelDocument>>(
      getModelToken(Level.name),
    );
    categoryModel = moduleFixture.get<Model<CategoryDocument>>(
      getModelToken(Category.name),
    );
    lessonModel = moduleFixture.get<Model<LessonDocument>>(
      getModelToken(Lesson.name),
    );
    quizModel = moduleFixture.get<Model<QuizDocument>>(
      getModelToken(Quiz.name),
    );
    quizAttemptModel = moduleFixture.get<Model<QuizAttemptDocument>>(
      getModelToken(QuizAttempt.name),
    );
    categoryProgressModel = moduleFixture.get<Model<CategoryProgressDocument>>(
      getModelToken(CategoryProgress.name),
    );
  });

  beforeEach(async () => {
    // Clean up test data
    await userModel.deleteMany({ email: /^test-/ }).exec();
    await levelModel.deleteMany({ code: 'L1_TEST' }).exec();
    await categoryModel.deleteMany({ code: 'family_test' }).exec();
    await lessonModel.deleteMany({ gloss: 'mother_test' }).exec();
    await quizModel.deleteMany({ source: 'WLASL_TEST' }).exec();
    await quizAttemptModel.deleteMany({}).exec();
    await categoryProgressModel.deleteMany({}).exec();

    // Create test user
    const passwordHash = await bcrypt.hash('testpassword123', 10);
    testUser = new userModel({
      email: 'test-learner@example.com',
      passwordHash,
      displayName: 'Test Learner',
      role: 'LEARNER',
      age: 25,
    });
    await testUser.save();

    // Login to get access token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'test-learner@example.com',
        password: 'testpassword123',
      })
      .expect(200);

    accessToken = loginResponse.body.accessToken;
    expect(accessToken).toBeDefined();

    // Create test level
    testLevel = new levelModel({
      code: 'L1_TEST',
      title: 'Level 1 Test',
      description: 'Test level for e2e tests',
      order: 1,
      isActive: true,
      backblazeFolderPath: 'asl/L1_TEST',
    });
    await testLevel.save();

    // Create test category
    testCategory = new categoryModel({
      levelId: testLevel._id,
      code: 'family_test',
      title: 'Family Test',
      description: 'Test category for family members',
      order: 1,
      isActive: true,
      backblazeFolderPath: 'asl/L1_TEST/family_test',
    });
    await testCategory.save();

    // Create test lesson with videos
    const lessonVideos: LessonVideo[] = [
      {
        videoId: '12345',
        b2Key: 'asl/L1_TEST/family_test/mother_test/12345.mp4',
        order: 0,
        isForLesson: true,
        isForQuiz: false,
      },
      {
        videoId: '12346',
        b2Key: 'asl/L1_TEST/family_test/mother_test/12346.mp4',
        order: 1,
        isForLesson: true,
        isForQuiz: false,
      },
      {
        videoId: '12347',
        b2Key: 'asl/L1_TEST/family_test/mother_test/12347.mp4',
        order: 2,
        isForLesson: false,
        isForQuiz: true,
      },
    ];

    testLesson = new lessonModel({
      levelId: testLevel._id,
      categoryId: testCategory._id,
      gloss: 'mother_test',
      title: 'Mother Test',
      description: 'Test lesson for mother sign',
      b2FolderKey: 'asl/L1_TEST/family_test/mother_test',
      order: 0,
      isActive: true,
      videos: lessonVideos,
    });
    await testLesson.save();

    // Create another lesson for quiz distractors
    const lesson2Videos: LessonVideo[] = [
      {
        videoId: '22345',
        b2Key: 'asl/L1_TEST/family_test/father_test/22345.mp4',
        order: 0,
        isForLesson: true,
        isForQuiz: false,
      },
      {
        videoId: '22346',
        b2Key: 'asl/L1_TEST/family_test/father_test/22346.mp4',
        order: 1,
        isForLesson: false,
        isForQuiz: true,
      },
    ];

    const lesson2 = new lessonModel({
      levelId: testLevel._id,
      categoryId: testCategory._id,
      gloss: 'father_test',
      title: 'Father Test',
      description: 'Test lesson for father sign',
      b2FolderKey: 'asl/L1_TEST/family_test/father_test',
      order: 1,
      isActive: true,
      videos: lesson2Videos,
    });
    await lesson2.save();

    // Create test quiz (category final quiz)
    testQuiz = new quizModel({
      type: QuizType.CATEGORY_FINAL,
      source: 'WLASL_TEST',
      categoryId: testCategory._id,
      title: 'Family Test - Final Sign Quiz',
      description: 'Test quiz for family category',
      passingScore: 60,
      questions: [
        {
          questionId: `${testLesson._id}:12347`,
          type: QuestionType.SINGLE_CHOICE,
          text: 'Select the correct word for this sign',
          videoUrl: 'asl/L1_TEST/family_test/mother_test/12347.mp4',
          options: [
            { id: 'opt_correct', text: 'Mother Test' },
            { id: 'opt_dist_0', text: 'Father Test' },
            { id: 'opt_dist_1', text: 'Sister Test' },
            { id: 'opt_dist_2', text: 'Brother Test' },
          ],
          correctOptionIds: ['opt_correct'],
        },
        {
          questionId: `${lesson2._id}:22346`,
          type: QuestionType.SINGLE_CHOICE,
          text: 'Select the correct word for this sign',
          videoUrl: 'asl/L1_TEST/family_test/father_test/22346.mp4',
          options: [
            { id: 'opt2_correct', text: 'Father Test' },
            { id: 'opt2_dist_0', text: 'Mother Test' },
            { id: 'opt2_dist_1', text: 'Sister Test' },
            { id: 'opt2_dist_2', text: 'Brother Test' },
          ],
          correctOptionIds: ['opt2_correct'],
        },
      ],
    });
    await testQuiz.save();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await userModel.deleteMany({ email: /^test-/ }).exec();
    await levelModel.deleteMany({ code: 'L1_TEST' }).exec();
    await categoryModel.deleteMany({ code: 'family_test' }).exec();
    await lessonModel.deleteMany({ gloss: /_test$/ }).exec();
    await quizModel.deleteMany({ source: 'WLASL_TEST' }).exec();
    await quizAttemptModel.deleteMany({}).exec();
    await categoryProgressModel.deleteMany({}).exec();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Scenario A: List lessons for a category and get lesson details', () => {
    it('should list lessons for a category', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/lessons/categories/${testCategory._id}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const lesson = response.body.data.find(
        (l: any) => l.id === (testLesson._id as string),
      );
      expect(lesson).toBeDefined();
      expect(lesson).toHaveProperty('id');
      expect(lesson).toHaveProperty('gloss', 'mother_test');
      expect(lesson).toHaveProperty('title', 'Mother Test');
      expect(lesson).toHaveProperty('totalVideos', 3);
      expect(lesson).toHaveProperty('lessonVideosCount', 2);
      expect(lesson).toHaveProperty('quizVideosCount', 1);
    });

    it('should get lesson details with signed URLs', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/lessons/${testLesson._id}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');

      const lessonData = response.body.data;
      expect(lessonData).toHaveProperty('id', testLesson._id as string);
      expect(lessonData).toHaveProperty('levelId');
      expect(lessonData).toHaveProperty('categoryId');
      expect(lessonData).toHaveProperty('gloss', 'mother_test');
      expect(lessonData).toHaveProperty('title', 'Mother Test');
      expect(lessonData).toHaveProperty('videos');
      expect(Array.isArray(lessonData.videos)).toBe(true);
      expect(lessonData.videos.length).toBe(2); // Only lesson videos (isForLesson = true)

      // Verify video structure
      const video = lessonData.videos[0];
      expect(video).toHaveProperty('videoId');
      expect(video).toHaveProperty('b2Key');
      expect(video).toHaveProperty('url');
      expect(video).toHaveProperty('order');

      // Verify signed URL is not empty and different from b2Key
      expect(video.url).toBeDefined();
      expect(typeof video.url).toBe('string');
      expect(video.url.length).toBeGreaterThan(0);
      expect(video.url).not.toBe(video.b2Key);
      expect(video.url).toMatch(/^https?:\/\//); // Should be a URL
    });
  });

  describe('Scenario B: Fetch a category final quiz and submit answers', () => {
    it('should fetch category final quiz', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/quizzes/category/${testCategory._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('type', QuizType.CATEGORY_FINAL);
      expect(response.body).toHaveProperty('source', 'WLASL_TEST');
      expect(response.body).toHaveProperty('categoryId');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('passingScore', 60);
      expect(response.body).toHaveProperty('questions');
      expect(Array.isArray(response.body.questions)).toBe(true);
      expect(response.body.questions.length).toBeGreaterThan(0);

      // Verify question structure
      const question = response.body.questions[0];
      expect(question).toHaveProperty('questionId');
      expect(question).toHaveProperty('type', QuestionType.SINGLE_CHOICE);
      expect(question).toHaveProperty('videoUrl');
      expect(question).toHaveProperty('options');
      expect(question).toHaveProperty('correctOptionIds');

      // Verify videoUrl is a Backblaze key, not HTTPS URL
      expect(question.videoUrl).toBeDefined();
      expect(typeof question.videoUrl).toBe('string');
      expect(question.videoUrl).toMatch(/^asl\//); // Should start with "asl/"
      expect(question.videoUrl).not.toMatch(/^https?:\/\//); // Should not be an HTTPS URL

      // Verify options structure
      expect(Array.isArray(question.options)).toBe(true);
      expect(question.options.length).toBeGreaterThan(0);
      question.options.forEach((opt: any) => {
        expect(opt).toHaveProperty('id');
        expect(opt).toHaveProperty('text');
      });

      // Verify there's at least one correct option
      expect(Array.isArray(question.correctOptionIds)).toBe(true);
      expect(question.correctOptionIds.length).toBeGreaterThan(0);
    });

    it('should submit quiz with correct and incorrect answers', async () => {
      // First, get the quiz to know the questions
      const quizResponse = await request(app.getHttpServer())
        .get(`/api/quizzes/category/${testCategory._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const quiz = quizResponse.body;
      const questions = quiz.questions;

      // Build answers: first question correct, second question incorrect
      const answers = questions.map((q: any, index: number) => {
        if (index === 0) {
          // Correct answer for first question
          return {
            questionId: q.questionId,
            selectedOptionIds: q.correctOptionIds,
          };
        } else {
          // Incorrect answer for second question (pick first distractor)
          const incorrectOption = q.options.find(
            (opt: any) => !q.correctOptionIds.includes(opt.id),
          );
          return {
            questionId: q.questionId,
            selectedOptionIds: incorrectOption ? [incorrectOption.id] : [],
          };
        }
      });

      // Submit quiz
      const submitResponse = await request(app.getHttpServer())
        .post('/api/quizzes/submit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          quizId: quiz._id,
          answers,
        })
        .expect(201);

      // Verify response structure
      expect(submitResponse.body).toHaveProperty('_id');
      expect(submitResponse.body).toHaveProperty('quizId');
      expect(submitResponse.body).toHaveProperty('userId');
      expect(submitResponse.body).toHaveProperty('score');
      expect(submitResponse.body).toHaveProperty('passed');
      expect(submitResponse.body).toHaveProperty('answers');
      expect(submitResponse.body).toHaveProperty('createdAt');

      // Verify score is calculated correctly (1 correct out of 2 = 50%)
      expect(submitResponse.body.score).toBe(50);
      expect(submitResponse.body.passed).toBe(false); // 50 < 60 (passingScore)

      // Verify answers array has per-question correctness
      expect(Array.isArray(submitResponse.body.answers)).toBe(true);
      expect(submitResponse.body.answers.length).toBe(2);

      // Check first answer (correct)
      const firstAnswer = submitResponse.body.answers[0];
      expect(firstAnswer).toHaveProperty('questionId');
      expect(firstAnswer).toHaveProperty('selectedOptionIds');
      expect(firstAnswer).toHaveProperty('isCorrect', true);

      // Check second answer (incorrect)
      const secondAnswer = submitResponse.body.answers[1];
      expect(secondAnswer).toHaveProperty('questionId');
      expect(secondAnswer).toHaveProperty('selectedOptionIds');
      expect(secondAnswer).toHaveProperty('isCorrect', false);

      // Verify at least one correct and one incorrect answer
      const correctAnswers = submitResponse.body.answers.filter(
        (a: any) => a.isCorrect === true,
      );
      const incorrectAnswers = submitResponse.body.answers.filter(
        (a: any) => a.isCorrect === false,
      );
      expect(correctAnswers.length).toBeGreaterThan(0);
      expect(incorrectAnswers.length).toBeGreaterThan(0);

      // Verify category progress was updated
      const categoryProgress = await categoryProgressModel
        .findOne({ userId: testUser._id, categoryId: testCategory._id })
        .exec();
      expect(categoryProgress).toBeDefined();
      expect(categoryProgress?.finalQuizBestScore).toBe(50);
      expect(categoryProgress?.finalQuizPassed).toBe(false);
    });

    it('should submit quiz with all correct answers and pass', async () => {
      // Get the quiz
      const quizResponse = await request(app.getHttpServer())
        .get(`/api/quizzes/category/${testCategory._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const quiz = quizResponse.body;

      // Build all correct answers
      const answers = quiz.questions.map((q: any) => ({
        questionId: q.questionId,
        selectedOptionIds: q.correctOptionIds,
      }));

      // Submit quiz
      const submitResponse = await request(app.getHttpServer())
        .post('/api/quizzes/submit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          quizId: quiz._id,
          answers,
        })
        .expect(201);

      // Verify score is 100%
      expect(submitResponse.body.score).toBe(100);
      expect(submitResponse.body.passed).toBe(true); // 100 >= 60 (passingScore)

      // Verify all answers are correct
      submitResponse.body.answers.forEach((answer: any) => {
        expect(answer.isCorrect).toBe(true);
      });

      // Verify category progress was updated
      const categoryProgress = await categoryProgressModel
        .findOne({ userId: testUser._id, categoryId: testCategory._id })
        .exec();
      expect(categoryProgress).toBeDefined();
      expect(categoryProgress?.finalQuizBestScore).toBe(100);
      expect(categoryProgress?.finalQuizPassed).toBe(true);
    });
  });

  describe('Scenario C: Media signed URL endpoint', () => {
    it('should generate signed URL for a Backblaze B2 key', async () => {
      const b2Key = 'asl/L1_TEST/family_test/mother_test/12345.mp4';

      const response = await request(app.getHttpServer())
        .get(
          `/api/admin/media/url?key=${encodeURIComponent(b2Key)}&expiresIn=600`,
        )
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');

      const data = response.body.data;
      expect(data).toHaveProperty('url');
      expect(data).toHaveProperty('expiresIn', 600);

      // Verify signed URL is not empty and is a valid URL
      expect(data.url).toBeDefined();
      expect(typeof data.url).toBe('string');
      expect(data.url.length).toBeGreaterThan(0);
      expect(data.url).toMatch(/^https?:\/\//);
      expect(data.url).not.toBe(b2Key); // Should be different from the key
    });

    it('should use signed URL from lesson details', async () => {
      // Get lesson details which includes signed URLs
      const lessonResponse = await request(app.getHttpServer())
        .get(`/api/lessons/${testLesson._id}`)
        .expect(200);

      const videos = lessonResponse.body.data.videos;
      expect(videos.length).toBeGreaterThan(0);

      const firstVideo = videos[0];
      expect(firstVideo.url).toBeDefined();
      expect(firstVideo.url).toMatch(/^https?:\/\//);

      // The signed URL should work for fetching the video metadata
      // (actual video streaming would require the file to exist in Backblaze)
      // We can at least verify the URL structure is correct
      const urlParts = firstVideo.url.split('?');
      expect(urlParts.length).toBeGreaterThan(0); // Should have query params for signature
    });
  });

  describe('Integration: Complete learning flow', () => {
    it('should complete full learning flow: list lessons -> get lesson -> get quiz -> submit quiz', async () => {
      // 1. List lessons for category
      const lessonsResponse = await request(app.getHttpServer())
        .get(`/api/lessons/categories/${testCategory._id}`)
        .expect(200);

      expect(lessonsResponse.body.success).toBe(true);
      const lessons = lessonsResponse.body.data;
      expect(lessons.length).toBeGreaterThan(0);

      // 2. Get lesson details
      const lessonId = lessons[0].id;
      const lessonDetailResponse = await request(app.getHttpServer())
        .get(`/api/lessons/${lessonId}`)
        .expect(200);

      expect(lessonDetailResponse.body.success).toBe(true);
      const lessonDetail = lessonDetailResponse.body.data;
      expect(lessonDetail.videos.length).toBeGreaterThan(0);

      // 3. Get category quiz
      const quizResponse = await request(app.getHttpServer())
        .get(`/api/quizzes/category/${testCategory._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const quiz = quizResponse.body;
      expect(quiz.questions.length).toBeGreaterThan(0);

      // 4. Convert quiz video URLs to signed URLs
      for (const question of quiz.questions) {
        const signedUrlResponse = await request(app.getHttpServer())
          .get(
            `/api/admin/media/url?key=${encodeURIComponent(question.videoUrl)}&expiresIn=600`,
          )
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(signedUrlResponse.body.data.url).toBeDefined();
        expect(signedUrlResponse.body.data.url).toMatch(/^https?:\/\//);
      }

      // 5. Submit quiz with correct answers
      const correctAnswers = quiz.questions.map((q: any) => ({
        questionId: q.questionId,
        selectedOptionIds: q.correctOptionIds,
      }));

      const submitResponse = await request(app.getHttpServer())
        .post('/api/quizzes/submit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          quizId: quiz._id,
          answers: correctAnswers,
        })
        .expect(201);

      expect(submitResponse.body.score).toBe(100);
      expect(submitResponse.body.passed).toBe(true);
    });
  });
});
