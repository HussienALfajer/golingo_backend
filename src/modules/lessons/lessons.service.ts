import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lesson, LessonDocument } from './schemas/lesson.schema';
import { MediaService } from '../media/media.service';

@Injectable()
export class LessonsService {
  constructor(
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<LessonDocument>,
    private readonly mediaService: MediaService,
  ) {}

  async getLessonsByCategory(categoryId: string) {
    const categoryObjectId = new Types.ObjectId(categoryId);

    const lessons = await this.lessonModel
      .find({ categoryId: categoryObjectId, isActive: true })
      .sort({ order: 1 })
      .exec();

    return lessons.map((lesson) => ({
      id: (lesson._id as Types.ObjectId).toString(),
      gloss: lesson.gloss,
      title: lesson.title,
      totalVideos: lesson.videos.length,
      lessonVideosCount: lesson.videos.filter((v) => v.isForLesson).length,
      quizVideosCount: lesson.videos.filter((v) => v.isForQuiz).length,
    }));
  }

  async getLessonDetail(lessonId: string) {
    const lesson = await this.lessonModel.findById(lessonId).exec();
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Only videos used for the lesson (not the quiz)
    const lessonVideos = lesson.videos.filter((v) => v.isForLesson);

    const videosWithChecks = await Promise.all(
      lessonVideos.map(async (v) => {
        const primaryKey = v.b2Key;
        let keyToUse = primaryKey;

        // Verify the object exists; if not, try a common fallback with /videos/
        const exists = await this.mediaService.fileExists(primaryKey);
        if (!exists) {
          const fallbackKey = `${lesson.b2FolderKey}/videos/${v.videoId}.mp4`;
          const fallbackExists =
            await this.mediaService.fileExists(fallbackKey);
          if (fallbackExists) {
            keyToUse = fallbackKey;
          } else {
            return null; // neither key exists; omit from response
          }
        }

        let url: string | null = null;
        try {
          url = await this.mediaService.getSignedUrl(keyToUse);
        } catch {
          url = null;
        }

        const stream = `/media/stream?key=${encodeURIComponent(keyToUse)}`;

        return {
          videoId: v.videoId,
          b2Key: keyToUse,
          url,
          stream,
          order: v.order,
        };
      }),
    );

    const videos = videosWithChecks.filter((v) => v !== null) as Array<{
      videoId: string;
      b2Key: string;
      url: string | null;
      stream: string;
      order: number;
    }>;

    return {
      id: (lesson._id as Types.ObjectId).toString(),
      levelId: lesson.levelId,
      categoryId: lesson.categoryId,
      gloss: lesson.gloss,
      title: lesson.title,
      description: lesson.description,
      videos,
    };
  }
}
