/**
 * Quizzes Service
 * Service for managing quizzes and quiz attempts
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Quiz, QuizDocument } from './schemas/quiz.schema';
import {
  QuizAttempt,
  QuizAttemptDocument,
  QuizAnswer,
} from './schemas/quiz-attempt.schema';
import { Question } from './schemas/question.schema';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { SubmitQuizDto, QuizAnswerDto } from './dto/submit-quiz.dto';
import { QuizType } from '../../common/enums/quiz-type.enum';
import { QuestionType } from '../../common/enums/question-type.enum';
import { Lesson, LessonDocument } from '../lessons/schemas/lesson.schema';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import { MediaService } from '../media/media.service';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectModel(Quiz.name) private quizModel: Model<QuizDocument>,
    @InjectModel(QuizAttempt.name)
    private quizAttemptModel: Model<QuizAttemptDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    private readonly mediaService: MediaService,
  ) {}

  /**
   * Create a new quiz
   */
  async create(createQuizDto: CreateQuizDto): Promise<QuizDocument> {
    const quiz = new this.quizModel(createQuizDto);
    return quiz.save();
  }

  /**
   * Convert videoUrl from b2Key or stream URL to signed URL (like lesson.videos[].url)
   */
  private async convertVideoUrlToSignedUrl(
    videoUrl: string | undefined,
  ): Promise<string | null> {
    if (!videoUrl) {
      return null;
    }

    // If it's already a signed URL (starts with http), check if it's still valid
    // If it's expired or about to expire, regenerate it
    if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
      // Check if URL contains expiration parameter
      try {
        const urlObj = new URL(videoUrl);
        const expiresParam = urlObj.searchParams.get('X-Amz-Expires');
        if (expiresParam) {
          // URL is a signed URL, check if it's still valid
          // For now, we'll regenerate it to ensure it's fresh (signed URLs expire after 1 hour)
          // Extract b2Key from the URL path
          const pathMatch = videoUrl.match(/sign-language-media\/(.+\.mp4)/);
          if (pathMatch && pathMatch[1]) {
            const b2Key = pathMatch[1];
            // Regenerate signed URL to ensure it's fresh
            return await this.mediaService.getSignedUrl(b2Key, 3600);
          }
        }
        // If we can't extract b2Key, return the URL as is (might be a different format)
        return videoUrl;
      } catch {
        // If URL parsing fails, treat it as a regular URL and return as is
        return videoUrl;
      }
    }

    // Extract b2Key from different formats
    let b2Key: string;

    // If it's a stream URL: /media/stream?key=...
    if (videoUrl.startsWith('/media/stream')) {
      const urlObj = new URL(videoUrl, 'http://dummy');
      const keyParam = urlObj.searchParams.get('key');
      if (keyParam) {
        b2Key = decodeURIComponent(keyParam);
      } else {
        return null;
      }
    }
    // If it's a b2Key (starts with asl/)
    else if (videoUrl.startsWith('asl/')) {
      b2Key = videoUrl;
    }
    // Unknown format
    else {
      return null;
    }

    // Convert b2Key to signed URL (same as lesson service, expires in 3600 seconds = 1 hour)
    // This URL can be used directly in <video> tag or video player to watch the video
    try {
      return await this.mediaService.getSignedUrl(b2Key, 3600);
    } catch (error) {
      console.error(`Failed to generate signed URL for ${b2Key}:`, error);
      return null;
    }
  }

  /**
   * Enrich quiz questions with signed URLs for videoUrl (legacy method for document-based quiz)
   * The videoUrl will be a signed URL that can be used directly in <video> tag or video player
   */
  private async enrichQuizWithSignedUrls(
    quiz: QuizDocument,
  ): Promise<QuizDocument> {
    if (!quiz.questions || quiz.questions.length === 0) {
      return quiz;
    }

    // Convert all videoUrls to signed URLs (same format as lesson.videos[].url)
    // These URLs can be used directly to watch videos
    const enrichedQuestions = await Promise.all(
      quiz.questions.map(async (question) => {
        if (question.videoUrl) {
          const signedUrl = await this.convertVideoUrlToSignedUrl(
            question.videoUrl,
          );
          // Use signed URL if available, otherwise keep original (fallback)
          return {
            ...question,
            videoUrl: signedUrl || question.videoUrl,
          };
        }
        return question;
      }),
    );

    // Create a new object with enriched questions (convert to plain object for JSON serialization)
    const quizObj = quiz.toObject();
    quizObj.questions = enrichedQuestions;

    // Return as QuizDocument (cast for type safety, but it's actually a plain object)
    return quizObj as QuizDocument;
  }

  /**
   * Enrich plain quiz object (from .lean()) with signed URLs and flatten nested structures
   * Ensures questions and options are flat arrays without __parentArray
   */
  private async enrichQuizPlain(quiz: any): Promise<any> {
    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];

    const enriched = await Promise.all(
      questions.map(async (q: any) => {
        let videoUrl = q.videoUrl;
        if (videoUrl) {
          const signed = await this.convertVideoUrlToSignedUrl(videoUrl);
          videoUrl = signed || videoUrl;
        }

        // Ensure options is a flat array (unwrap __parentArray if present)
        let options = q.options;
        if (options && !Array.isArray(options)) {
          if (options.__parentArray && Array.isArray(options.__parentArray)) {
            options = options.__parentArray;
          } else {
            // If options is not an array and doesn't have __parentArray, default to empty array
            options = [];
          }
        }

        // Return question with flattened options and signed videoUrl
        return { ...q, videoUrl, options };
      }),
    );

    return { ...quiz, questions: enriched };
  }

  /**
   * Find all quizzes
   * @param limit - Maximum number of quizzes to return (default: 50, max: 100)
   * @param skip - Number of quizzes to skip (default: 0)
   * @param includeQuestions - Whether to include questions (default: false for listing)
   * @param enrichUrls - Whether to enrich video URLs with signed URLs (default: false for listing)
   */
  async findAll(
    limit: number = 50,
    skip: number = 0,
    includeQuestions: boolean = false,
    enrichUrls: boolean = false,
  ): Promise<QuizDocument[]> {
    // Cap limit at 100 to prevent huge responses
    const cappedLimit = Math.min(limit, 100);
    const cappedSkip = Math.max(0, skip);

    let query = this.quizModel.find();

    // If not including questions, exclude them to reduce payload size
    if (!includeQuestions) {
      query = query.select('-questions');
    }

    // Use .lean() to get plain JavaScript objects directly from MongoDB
    // This avoids Mongoose document overhead and circular reference issues
    const quizzes = await query
      .lean()
      .limit(cappedLimit)
      .skip(cappedSkip)
      .exec();

    // Only enrich URLs if requested (skip for listing to reduce payload)
    if (enrichUrls && includeQuestions) {
      // For URL enrichment, we need to convert back to documents temporarily
      const enriched = await Promise.all(
        quizzes.map(async (quiz) => {
          const doc = new this.quizModel(quiz);
          return this.enrichQuizWithSignedUrls(doc);
        }),
      );
      return enriched;
    }

    // Return plain objects (already lean, no conversion needed)
    return quizzes as any;
  }

  /**
   * Find quiz by ID
   */
  async findOne(id: string): Promise<any> {
    const quiz = await this.quizModel.findById(id).lean().exec();
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }
    // Use plain object enricher to ensure flat JSON structure
    return this.enrichQuizPlain(quiz);
  }

  /**
   * Find quiz by category ID (category final quiz)
   */
  async findByCategory(categoryId: string): Promise<any | null> {
    if (!Types.ObjectId.isValid(categoryId)) {
      throw new BadRequestException('Invalid categoryId');
    }
    // Convert string to ObjectId for query
    const objectId = new Types.ObjectId(categoryId);
    const quiz = await this.quizModel
      .findOne({ type: QuizType.CATEGORY_FINAL, categoryId: objectId })
      .lean()
      .exec();
    if (!quiz) {
      return null;
    }
    // Use plain object enricher to ensure flat JSON structure
    return this.enrichQuizPlain(quiz);
  }

  /**
   * Submit quiz answers and calculate score
   */
  async submitQuiz(
    userId: string,
    submitQuizDto: SubmitQuizDto,
  ): Promise<QuizAttemptDocument> {
    const quiz = await this.findOne(submitQuizDto.quizId);

    // Validate answers and calculate score with correctness
    const { score, answersWithCorrectness } =
      this.calculateScoreWithCorrectness(quiz, submitQuizDto.answers);
    const passed = score >= quiz.passingScore;

    // Create quiz attempt
    // Ensure quizId is converted to ObjectId (handle both string and ObjectId formats)
    let quizIdObj: Types.ObjectId;
    const rawQuizId = quiz._id || quiz.id;
    if (rawQuizId instanceof Types.ObjectId) {
      quizIdObj = rawQuizId;
    } else if (typeof rawQuizId === 'string') {
      quizIdObj = new Types.ObjectId(rawQuizId);
    } else {
      // Fallback: use the quizId from DTO
      quizIdObj = new Types.ObjectId(submitQuizDto.quizId);
    }

    // Ensure userId is converted to ObjectId
    // userId is always a string in this method, so convert it
    const userIdObj = new Types.ObjectId(userId);

    const attempt = new this.quizAttemptModel({
      quizId: quizIdObj,
      userId: userIdObj,
      score,
      passed,
      answers: answersWithCorrectness,
    });

    return attempt.save();
  }

  /**
   * Calculate quiz score based on answers and return answers with correctness
   */
  private calculateScoreWithCorrectness(
    quiz: any,
    answers: QuizAnswerDto[],
  ): { score: number; answersWithCorrectness: QuizAnswer[] } {
    let correctCount = 0;
    const totalQuestions = quiz.questions.length;
    const answersWithCorrectness: QuizAnswer[] = [];

    for (const question of quiz.questions) {
      const answer = answers.find((a) => a.questionId === question.questionId);

      if (!answer) {
        answersWithCorrectness.push({
          questionId: question.questionId,
          selectedOptionIds: [],
          isCorrect: false,
        });
        continue;
      }

      const selectedSet = new Set(answer.selectedOptionIds.sort());
      const correctSet = new Set(question.correctOptionIds.sort());

      const isCorrect = this.setsEqual(selectedSet, correctSet);
      if (isCorrect) {
        correctCount++;
      }

      answersWithCorrectness.push({
        questionId: question.questionId,
        selectedOptionIds: answer.selectedOptionIds,
        isCorrect,
      });
    }

    const score =
      totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;

    return { score, answersWithCorrectness };
  }

  /**
   * Check if two sets are equal
   */
  private setsEqual<T>(setA: Set<T>, setB: Set<T>): boolean {
    if (setA.size !== setB.size) {
      return false;
    }
    for (const item of setA) {
      if (!setB.has(item)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get best score for a user on a quiz
   */
  async getBestScore(quizId: string, userId: string): Promise<number> {
    // Validate and convert string IDs to ObjectIds for proper MongoDB query
    if (!Types.ObjectId.isValid(quizId)) {
      throw new BadRequestException('Invalid quizId');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId');
    }

    // Clean userId - remove any trailing commas or whitespace that might be in stored data
    const cleanUserId = userId.trim().replace(/[,;]\s*$/, '');

    const quizObjectId = new Types.ObjectId(quizId);
    const userObjectId = new Types.ObjectId(cleanUserId);

    // Query using $or to handle both ObjectId and string formats
    // MongoDB automatically handles ObjectId/string matching for ObjectId fields
    // Use find().sort().limit(1) to explicitly get the best score across all attempts
    const attempts = await this.quizAttemptModel
      .find({
        $or: [
          // Primary query: ObjectId format (MongoDB will auto-match string values too)
          { quizId: quizObjectId, userId: userObjectId },
          // Fallback: String format (handles cases where data might be stored as strings)
          { quizId: quizId, userId: cleanUserId },
          // Additional fallbacks for mixed formats
          { quizId: quizObjectId, userId: cleanUserId },
          { quizId: quizId, userId: userObjectId },
        ],
      })
      .sort({ score: -1 }) // Sort descending to get highest score first
      .limit(1) // Get only the best score
      .exec();

    return attempts.length > 0 && attempts[0] ? attempts[0].score : 0;
  }

  /**
   * Get all attempts for a user on a quiz
   */
  async getUserAttempts(
    quizId: string,
    userId: string,
  ): Promise<QuizAttemptDocument[]> {
    // Validate IDs
    if (!Types.ObjectId.isValid(quizId)) {
      throw new BadRequestException('Invalid quizId');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId');
    }

    // Clean userId - remove any trailing commas or whitespace that might be in stored data
    const cleanUserId = userId.trim().replace(/[,;]\s*$/, '');

    // Convert to ObjectIds
    const quizObjectId = new Types.ObjectId(quizId);
    const userObjectId = new Types.ObjectId(cleanUserId);
    // MongoDB automatically handles ObjectId/string matching for ObjectId fields
    // Query using ObjectIds (MongoDB will match both ObjectId and string formats)
    // Also try with string format as fallback to handle edge cases
    const attempts = await this.quizAttemptModel
      .find({
        $or: [
          // Primary query: ObjectId format (MongoDB will auto-match string values too)
          { quizId: quizObjectId, userId: userObjectId },
          // Fallback: String format (handles cases where data might be stored as strings)
          { quizId: quizId, userId: cleanUserId },
          // Additional fallbacks for mixed formats
          { quizId: quizObjectId, userId: cleanUserId },
          { quizId: quizId, userId: userObjectId },
        ],
      })
      .sort({ createdAt: -1 })
      .exec();

    return attempts;
  }

  /**
   * Get all attempts for a user across all quizzes
   */
  async getAllUserAttempts(
    userId: string,
  ): Promise<QuizAttemptDocument[]> {
    // Validate userId
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId');
    }

    // Clean userId - remove any trailing commas or whitespace that might be in stored data
    const cleanUserId = userId.trim().replace(/[,;]\s*$/, '');

    // Convert to ObjectId
    const userObjectId = new Types.ObjectId(cleanUserId);

    // Query using $or to handle both ObjectId and string formats
    const attempts = await this.quizAttemptModel
      .find({
        $or: [
          // Primary query: ObjectId format (MongoDB will auto-match string values too)
          { userId: userObjectId },
          // Fallback: String format (handles cases where data might be stored as strings)
          { userId: cleanUserId },
        ],
      })
      .sort({ createdAt: -1 })
      .exec();

    return attempts;
  }

  /**
   * Get all attempts for a quiz (across all users)
   */
  async getQuizAttempts(quizId: string): Promise<QuizAttemptDocument[]> {
    // Validate quizId
    if (!Types.ObjectId.isValid(quizId)) {
      throw new BadRequestException('Invalid quizId');
    }

    // Convert to ObjectId
    const quizObjectId = new Types.ObjectId(quizId);

    // Query using $or to handle both ObjectId and string formats
    const attempts = await this.quizAttemptModel
      .find({
        $or: [
          // Primary query: ObjectId format (MongoDB will auto-match string values too)
          { quizId: quizObjectId },
          // Fallback: String format (handles cases where data might be stored as strings)
          { quizId: quizId },
        ],
      })
      .sort({ createdAt: -1 })
      .exec();

    return attempts;
  }

  /**
   * Get best score for a quiz (across all users)
   */
  async getBestScoreForQuiz(quizId: string): Promise<number> {
    // Validate quizId
    if (!Types.ObjectId.isValid(quizId)) {
      throw new BadRequestException('Invalid quizId');
    }

    // Convert to ObjectId
    const quizObjectId = new Types.ObjectId(quizId);

    // Query using $or to handle both ObjectId and string formats
    // Sort by score descending to get the best score first
    const attempts = await this.quizAttemptModel
      .find({
        $or: [
          // Primary query: ObjectId format (MongoDB will auto-match string values too)
          { quizId: quizObjectId },
          // Fallback: String format (handles cases where data might be stored as strings)
          { quizId: quizId },
        ],
      })
      .sort({ score: -1 }) // Sort descending to get highest score first
      .limit(1) // Get only the best score
      .exec();

    return attempts.length > 0 && attempts[0] ? attempts[0].score : 0;
  }

  /**
   * Get best score for a user across all quizzes
   */
  async getBestScoreAcrossAllQuizzes(userId: string): Promise<number> {
    // Validate userId
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId');
    }

    // Clean userId - remove any trailing commas or whitespace that might be in stored data
    const cleanUserId = userId.trim().replace(/[,;]\s*$/, '');

    // Convert to ObjectId
    const userObjectId = new Types.ObjectId(cleanUserId);

    // Query using $or to handle both ObjectId and string formats
    // Sort by score descending to get the best score first
    const attempts = await this.quizAttemptModel
      .find({
        $or: [
          // Primary query: ObjectId format (MongoDB will auto-match string values too)
          { userId: userObjectId },
          // Fallback: String format (handles cases where data might be stored as strings)
          { userId: cleanUserId },
        ],
      })
      .sort({ score: -1 }) // Sort descending to get highest score first
      .limit(1) // Get only the best score
      .exec();

    return attempts.length > 0 && attempts[0] ? attempts[0].score : 0;
  }

  /**
   * Get last attempt for a user on a quiz
   */
  async getLastAttempt(
    quizId: string,
    userId: string,
  ): Promise<QuizAttemptDocument | null> {
    // Validate and convert string IDs to ObjectIds for proper MongoDB query
    if (!Types.ObjectId.isValid(quizId)) {
      throw new BadRequestException('Invalid quizId');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId');
    }

    const quizObjectId = new Types.ObjectId(quizId);
    const userObjectId = new Types.ObjectId(userId);

    return this.quizAttemptModel
      .findOne({ quizId: quizObjectId, userId: userObjectId })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Update quiz
   */
  async update(
    id: string,
    updateData: Partial<CreateQuizDto>,
  ): Promise<QuizDocument> {
    const quiz = await this.quizModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }
    return quiz;
  }

  /**
   * Delete quiz
   */
  async remove(id: string): Promise<void> {
    const result = await this.quizModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Quiz not found');
    }
  }

  /**
   * Generate or update a category final quiz from WLASL lessons
   */
  async generateCategoryFinalQuizFromLessons(
    categoryId: string,
  ): Promise<QuizDocument> {
    if (!Types.ObjectId.isValid(categoryId)) {
      throw new BadRequestException('Invalid categoryId');
    }
    // Convert string to ObjectId for queries
    const objectId = new Types.ObjectId(categoryId);
    // Fetch category
    const category = await this.categoryModel.findById(objectId).exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Fetch all lessons for this category
    const lessons = await this.lessonModel
      .find({ categoryId: objectId })
      .exec();

    if (lessons.length === 0) {
      throw new BadRequestException('No lessons found for this category');
    }

    const questions: Question[] = [];
    const allLessonWords: string[] = [];

    // Collect all lesson words for distractors
    lessons.forEach((lesson) => {
      allLessonWords.push(lesson.title || lesson.gloss);
    });

    // Generate questions from quiz videos
    for (const lesson of lessons) {
      // Collect quiz videos
      let videosForQuiz = lesson.videos.filter((v) => v.isForQuiz === true);

      // If no quiz videos but lesson has only one video, use it for quiz
      if (videosForQuiz.length === 0 && lesson.videos.length === 1) {
        videosForQuiz = lesson.videos;
      }

      // Generate a question for each quiz video
      for (const video of videosForQuiz) {
        const questionId = `${lesson._id}:${video.videoId}`;
        const correctWord = lesson.title || lesson.gloss;

        // Use same logic as lesson service to verify file exists and handle fallback
        const primaryKey = video.b2Key;
        let keyToUse = primaryKey;

        // Verify the object exists; if not, try a common fallback with /videos/
        const exists = await this.mediaService.fileExists(primaryKey);
        if (!exists) {
          const fallbackKey = `${lesson.b2FolderKey}/videos/${video.videoId}.mp4`;
          const fallbackExists =
            await this.mediaService.fileExists(fallbackKey);
          if (fallbackExists) {
            keyToUse = fallbackKey;
          } else {
            // Skip this video if neither key exists
            continue;
          }
        }

        // Generate distractors (3-4 random words from other lessons in the same category)
        const distractors = this.getRandomDistractors(
          allLessonWords.filter((word) => word !== correctWord),
          3,
        );

        // Create options: correct answer + distractors
        const options: Array<{ id: string; text: string }> = [];
        const correctOptionId = `opt_${questionId}_correct`;
        options.push({ id: correctOptionId, text: correctWord });

        distractors.forEach((distractor, index) => {
          options.push({
            id: `opt_${questionId}_dist_${index}`,
            text: distractor,
          });
        });

        // Shuffle options to randomize position
        this.shuffleArray(options);

        // Find the correct option ID after shuffling
        const correctOption = options.find((opt) => opt.text === correctWord);
        if (!correctOption) {
          throw new Error('Failed to find correct option after shuffling');
        }

        // Store verified b2Key in database (will be converted to signed URL when returned)
        // This uses the same key that would be used in lesson service
        const videoUrl = keyToUse;

        questions.push({
          questionId,
          type: QuestionType.SINGLE_CHOICE,
          text: 'Select the correct word for this sign',
          videoUrl,
          options,
          correctOptionIds: [correctOption.id],
        });
      }
    }

    if (questions.length === 0) {
      throw new BadRequestException(
        'No quiz videos found for lessons in this category',
      );
    }

    // Check if quiz already exists
    const existingQuiz = await this.quizModel
      .findOne({
        type: QuizType.CATEGORY_FINAL,
        categoryId: objectId,
        source: 'WLASL',
      })
      .exec();

    const quizData = {
      type: QuizType.CATEGORY_FINAL,
      source: 'WLASL',
      categoryId: objectId,
      title: `${category.title} - Final Sign Quiz`,
      description: 'Final recognition quiz generated from WLASL lessons',
      passingScore: 60,
      questions,
    };

    if (existingQuiz) {
      // Update existing quiz
      existingQuiz.questions = questions;
      existingQuiz.passingScore = 60;
      existingQuiz.title = quizData.title;
      existingQuiz.description = quizData.description;
      return existingQuiz.save();
    } else {
      // Create new quiz
      const quiz = new this.quizModel(quizData);
      return quiz.save();
    }
  }

  /**
   * Get random distractors from a list
   */
  private getRandomDistractors(words: string[], count: number): string[] {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * Shuffle array in place (Fisher-Yates algorithm)
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
