# Sign Language Learning Platform - Backend

A production-grade NestJS backend for a mobile application that teaches sign language to deaf children. This backend provides comprehensive APIs for content management, user progress tracking, quizzes, achievements, and notifications.

## Features

- 🔐 **Authentication & Authorization**: JWT-based authentication with refresh tokens, role-based access control (Admin/Learner)
- 📚 **Content Management**: Hierarchical content structure (Levels → Categories → Lessons)
- 📝 **Quizzes**: Lesson quizzes and category final quizzes with flexible question types
- 📊 **Progress Tracking**: Automatic progression unlocking based on quiz scores (60% minimum)
- 🏆 **Achievements**: Badge system with automatic unlocking
- 🔔 **Notifications**: Real-time notifications for progress, achievements, and unlocks
- 📁 **Media Storage**: Backblaze B2 integration for videos, images, and files
- 🔒 **Security**: Helmet, CORS, rate limiting, input validation
- 📖 **API Documentation**: Swagger/OpenAPI documentation
- ✅ **Testing**: Unit and e2e tests

## Tech Stack

- **Framework**: NestJS 11
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (Passport.js)
- **Storage**: Backblaze B2 (S3-compatible)
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI
- **Security**: Helmet, CORS, @nestjs/throttler

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (running locally or connection string)
- Backblaze B2 account (for media storage)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sign_language_platform_workspace_backend
```

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

3. Create a `.env` file in the root directory with the following variables:

```env
# Application Configuration
APP_NAME=sign-language-platform
NODE_ENV=development
PORT=3000
API_PREFIX=api

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/sign_language

# Authentication Configuration
JWT_SECRET=changeme-please-change-this-in-production
JWT_EXPIRES_IN=3600
JWT_REFRESH_SECRET=changeme-refresh-please-change-this-in-production
JWT_REFRESH_EXPIRES_IN=604800

# CORS Configuration
AR_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4200

# Storage Configuration
STORAGE_PROVIDER=backblaze
STORAGE_BUCKET=sign-language-media
STORAGE_BASE_URL=https://f005.backblazeb2.com/file/sign-language-media
AWS_ACCESS_KEY_ID=your_backblaze_key_id
AWS_SECRET_ACCESS_KEY=your_backblaze_application_key
AWS_REGION=us-east-005
AWS_S3_ENDPOINT=https://s3.us-east-005.backblazeb2.com

# Firebase Configuration (optional, for push notifications)
FIREBASE_SERVICE_ACCOUNT=
```

**Important**: Replace all placeholder values with your actual credentials. Never commit the `.env` file to version control.

## Running the Application

### Development
```bash
npm run start:dev
```

The application will start on `http://localhost:3000` (or the PORT specified in `.env`).

### Production
```bash
npm run build
npm run start:prod
```

### View API Documentation

Once the application is running, access Swagger documentation at:
```
http://localhost:3000/api/docs
```

## Project Structure

```
src/
├── common/              # Shared utilities, guards, interceptors, filters, decorators
│   ├── decorators/
│   ├── enums/
│   ├── filters/
│   ├── guards/
│   └── interceptors/
├── config/              # Configuration module with environment validation
├── modules/             # Feature modules
│   ├── auth/           # Authentication (JWT, registration, login)
│   ├── users/          # User management
│   ├── levels/         # Level management (admin)
│   ├── categories/     # Category management
│   ├── lessons/        # Lesson management
│   ├── quizzes/        # Quiz management and submissions
│   ├── progress/       # Progress tracking and unlocking logic
│   ├── achievements/   # Achievements and badges
│   ├── notifications/  # User notifications
│   └── media/          # Media upload (Backblaze B2)
└── main.ts             # Application entry point
```

## API Endpoints Overview

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/me` - Get current user

### Levels (Admin)
- `GET /api/admin/levels` - Get all levels
- `POST /api/admin/levels` - Create level
- `PATCH /api/admin/levels/:id` - Update level
- `DELETE /api/admin/levels/:id` - Delete level (soft delete)

### Categories
- `GET /api/categories` - Get all categories (filter by levelId)
- `POST /api/categories` - Create category (admin)
- `PATCH /api/categories/:id` - Update category (admin)
- `DELETE /api/categories/:id` - Delete category (admin)

### Lessons
- `GET /api/lessons` - Get all lessons (filter by categoryId)
- `GET /api/lessons/:id` - Get lesson details
- `POST /api/lessons` - Create lesson (admin)
- `PATCH /api/lessons/:id` - Update lesson (admin)

### Quizzes
- `GET /api/quizzes` - Get all quizzes
- `GET /api/quizzes/:id` - Get quiz details
- `POST /api/quizzes` - Create quiz (admin)
- `POST /api/quizzes/submit` - Submit quiz answers (learner)
- `GET /api/quizzes/:id/attempts` - Get user attempts
- `GET /api/quizzes/:id/best-score` - Get best score

### Progress (Learner)
- `GET /api/me/progress/levels` - Get all levels with progress
- `GET /api/me/progress/levels/:levelId` - Get level progress
- `GET /api/me/progress/categories/:categoryId` - Get category progress
- `POST /api/me/progress/lessons/:lessonId/mark-watched` - Mark lesson as watched

### Achievements
- `GET /api/achievements` - Get all achievements
- `GET /api/achievements/me` - Get user achievements

### Notifications
- `GET /api/notifications` - Get user notifications
- `GET /api/notifications/unread-count` - Get unread count
- `PATCH /api/notifications/:id/read` - Mark as read
- `PATCH /api/notifications/read-all` - Mark all as read

### Media (Admin)
- `POST /api/admin/media/levels/:levelId/categories/:categoryId/upload` - Upload file to category
- `DELETE /api/admin/media/files/:key` - Delete file

## Progression System

The backend enforces a strict progression system:

1. **Level Unlocking**:
   - Level 1 is unlocked by default for new learners
   - Higher levels unlock when all category final quizzes in the previous level are passed (≥60%)

2. **Category Unlocking**:
   - First category in each level is unlocked when the level is unlocked
   - Subsequent categories unlock when the previous category's final quiz is passed (≥60%)

3. **Lesson Unlocking**:
   - First lesson in each category is unlocked when the category is unlocked
   - Subsequent lessons unlock when:
     - The previous lesson is watched (marked as watched)
     - AND the previous lesson's quiz is passed (≥60%)

4. **Completion**:
   - A lesson is completed when: watched = true AND quiz passed = true
   - A category is completed when: final category quiz passed = true
   - A level is completed when: all categories completed = true

## Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### Test Coverage
```bash
npm run test:cov
```

## Security Features

- **Helmet**: HTTP security headers
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: Protection against brute force attacks
- **Input Validation**: All inputs validated via DTOs
- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Secure token-based authentication
- **Role-Based Access Control**: Admin vs Learner permissions

## Environment Variables

All environment variables are validated using Joi schema. Invalid configurations will prevent the application from starting.

Required variables:
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `AR_ALLOWED_ORIGINS`
- `STORAGE_BUCKET`
- `STORAGE_BASE_URL`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_ENDPOINT`

## Error Handling

The application uses a global exception filter that returns consistent error responses:

```json
{
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "message": "Error message",
  "error": "Bad Request"
}
```

## Contributing

1. Follow the existing code structure and patterns
2. Write tests for new features
3. Update API documentation (Swagger decorators)
4. Ensure all linting checks pass

## License

This project is private and proprietary.

## Support

For issues or questions, please contact the development team.
