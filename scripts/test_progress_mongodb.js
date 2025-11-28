/**
 * MongoDB Scripts for Testing Educational Progress System
 * استخدم هذا الملف لاختبار وتعديل بيانات التقدم التعليمي
 * 
 * الاستخدام:
 * 1. افتح MongoDB Shell
 * 2. استخدم: load('scripts/test_progress_mongodb.js')
 * 3. استدعي الدوال المطلوبة
 */

// ============================================
// 🔧 متغيرات الإعداد
// ============================================
var TEST_USER_ID = null; // ضع هنا معرف المستخدم للاختبار
var DATABASE_NAME = 'sign_language_platform'; // اسم قاعدة البيانات

// اختر قاعدة البيانات
use(DATABASE_NAME);

// ============================================
// 📊 1. عرض معلومات المستخدمين
// ============================================
function showAllLearners() {
    print("\n" + "=".repeat(60));
    print("👥 جميع مستخدمي التعلم:");
    print("=".repeat(60));
    
    var learners = db.users.find({ role: "LEARNER" }).toArray();
    
    learners.forEach(function(user, index) {
        print("\n" + (index + 1) + ". " + user.displayName);
        print("   - Email: " + user.email);
        print("   - ID: " + user._id);
        print("   - Created: " + user.createdAt);
    });
    
    print("\n📌 استخدم: setTestUserId('USER_ID_HERE')");
    return learners;
}

// ============================================
// 🔧 2. تعيين معرف المستخدم للاختبار
// ============================================
function setTestUserId(userId) {
    TEST_USER_ID = ObjectId(userId);
    var user = db.users.findOne({ _id: TEST_USER_ID });
    if (user) {
        print("✅ تم تعيين المستخدم: " + user.displayName + " (" + user.email + ")");
    } else {
        print("❌ المستخدم غير موجود!");
    }
    return TEST_USER_ID;
}

// ============================================
// 📊 3. عرض التقدم الحالي للمستخدم
// ============================================
function showUserProgress(userId) {
    if (!userId) userId = TEST_USER_ID;
    if (!userId) {
        print("❌ يجب تعيين معرف المستخدم أولاً!");
        return;
    }
    
    var user = db.users.findOne({ _id: userId });
    if (!user) {
        print("❌ المستخدم غير موجود!");
        return;
    }
    
    print("\n" + "=".repeat(60));
    print("📊 تقرير التقدم للمستخدم: " + user.displayName);
    print("=".repeat(60));
    
    // المستويات
    print("\n📚 المستويات:");
    var levelProgress = db.level_progress.find({ userId: userId }).toArray();
    if (levelProgress.length === 0) {
        print("   ⚠️  لا يوجد تقدم في المستويات");
    } else {
        levelProgress.forEach(function(lp) {
            var level = db.levels.findOne({ _id: lp.levelId });
            if (level) {
                var status = lp.allCategoriesCompleted ? "✅ مكتمل" : 
                            (lp.unlockedAt ? "🔓 مفتوح" : "🔒 مغلق");
                print("   - " + level.title + " (" + level.code + "): " + status);
            }
        });
    }
    
    // الفئات
    print("\n📁 الفئات:");
    var categoryProgress = db.category_progress.find({ userId: userId }).toArray();
    if (categoryProgress.length === 0) {
        print("   ⚠️  لا يوجد تقدم في الفئات");
    } else {
        categoryProgress.forEach(function(cp) {
            var category = db.categories.findOne({ _id: cp.categoryId });
            if (category) {
                var status = cp.finalQuizPassed ? "✅ مكتمل (نتيجة: " + (cp.finalQuizBestScore || 0) + "%)" : 
                            (cp.unlockedAt ? "🔓 مفتوح" : "🔒 مغلق");
                print("   - " + category.title + ": " + status);
            }
        });
    }
    
    // الدروس
    print("\n📖 الدروس:");
    var lessonProgress = db.lesson_progress.find({ userId: userId }).toArray();
    if (lessonProgress.length === 0) {
        print("   ⚠️  لا يوجد تقدم في الدروس");
    } else {
        lessonProgress.forEach(function(lep) {
            var lesson = db.lessons.findOne({ _id: lep.lessonId });
            if (lesson) {
                var lessonVideos = lesson.videos.filter(v => v.isForLesson === true);
                var videoCount = lessonVideos.length;
                var watchedCount = lep.watchedVideos.length;
                var percentage = videoCount > 0 ? Math.round((watchedCount / videoCount) * 100) : 0;
                
                var status = lep.allVideosWatched ? "✅ مكتمل" : 
                            (lep.unlockedAt ? "🔓 مفتوح (" + watchedCount + "/" + videoCount + " - " + percentage + "%)" : "🔒 مغلق");
                print("   - " + lesson.title + " (" + lesson.gloss + "): " + status);
            }
        });
    }
    
    print("\n" + "=".repeat(60));
}

// ============================================
// 🗑️ 4. حذف جميع التقدم للمستخدم
// ============================================
function resetUserProgress(userId) {
    if (!userId) userId = TEST_USER_ID;
    if (!userId) {
        print("❌ يجب تعيين معرف المستخدم أولاً!");
        return;
    }
    
    var user = db.users.findOne({ _id: userId });
    if (!user) {
        print("❌ المستخدم غير موجود!");
        return;
    }
    
    var levelCount = db.level_progress.countDocuments({ userId: userId });
    var categoryCount = db.category_progress.countDocuments({ userId: userId });
    var lessonCount = db.lesson_progress.countDocuments({ userId: userId });
    var attemptCount = db.quiz_attempts.countDocuments({ userId: userId });
    
    db.level_progress.deleteMany({ userId: userId });
    db.category_progress.deleteMany({ userId: userId });
    db.lesson_progress.deleteMany({ userId: userId });
    db.quiz_attempts.deleteMany({ userId: userId });
    
    print("✅ تم حذف جميع سجلات التقدم:");
    print("   - المستويات: " + levelCount);
    print("   - الفئات: " + categoryCount);
    print("   - الدروس: " + lessonCount);
    print("   - محاولات الاختبار: " + attemptCount);
}

// ============================================
// 🆕 5. تهيئة تقدم جديد للمستخدم
// ============================================
function initializeUserProgress(userId) {
    if (!userId) userId = TEST_USER_ID;
    if (!userId) {
        print("❌ يجب تعيين معرف المستخدم أولاً!");
        return;
    }
    
    var user = db.users.findOne({ _id: userId });
    if (!user) {
        print("❌ المستخدم غير موجود!");
        return;
    }
    
    // احذف التقدم السابق
    resetUserProgress(userId);
    
    // 1. احصل على Level 1
    var level1 = db.levels.findOne({ order: 1, isActive: true, deletedAt: null });
    if (!level1) {
        print("❌ Level 1 غير موجود!");
        return;
    }
    
    // إنشاء تقدم المستوى
    db.level_progress.insertOne({
        userId: userId,
        levelId: level1._id,
        unlockedAt: new Date(),
        allCategoriesCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    print("✅ تم فتح Level 1: " + level1.title);
    
    // 2. احصل على الفئة الأولى من Level 1
    var firstCategory = db.categories.findOne({ 
        levelId: level1._id, 
        isActive: true,
        deletedAt: null
    }, { sort: { order: 1 } });
    
    if (!firstCategory) {
        print("⚠️  لا توجد فئات في Level 1");
        return;
    }
    
    // إنشاء تقدم الفئة
    db.category_progress.insertOne({
        userId: userId,
        categoryId: firstCategory._id,
        unlockedAt: new Date(),
        finalQuizPassed: false,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    print("✅ تم فتح الفئة الأولى: " + firstCategory.title);
    
    // 3. احصل على الدرس الأول من الفئة
    var firstLesson = db.lessons.findOne({ 
        categoryId: firstCategory._id, 
        isActive: true
    }, { sort: { order: 1 } });
    
    if (!firstLesson) {
        print("⚠️  لا توجد دروس في الفئة الأولى");
        return;
    }
    
    // إنشاء تقدم الدرس
    db.lesson_progress.insertOne({
        userId: userId,
        lessonId: firstLesson._id,
        watchedVideos: [],
        allVideosWatched: false,
        unlockedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
    });
    print("✅ تم فتح الدرس الأول: " + firstLesson.title);
    
    print("\n✅ تم تهيئة التقدم بنجاح!");
    showUserProgress(userId);
}

// ============================================
// ✅ 6. إكمال درس معين
// ============================================
function completeLesson(userId, lessonId) {
    if (!userId) userId = TEST_USER_ID;
    if (!userId) {
        print("❌ يجب تعيين معرف المستخدم أولاً!");
        return;
    }
    
    var lesson = db.lessons.findOne({ _id: ObjectId(lessonId) });
    if (!lesson) {
        print("❌ الدرس غير موجود!");
        return;
    }
    
    // احصل على جميع videoIds من الدرس (فقط ones for lesson)
    var videoIds = lesson.videos
        .filter(v => v.isForLesson === true)
        .map(v => v.videoId);
    
    if (videoIds.length === 0) {
        print("⚠️  لا توجد فيديوهات في هذا الدرس");
        return;
    }
    
    // تحديث أو إنشاء تقدم الدرس
    var result = db.lesson_progress.updateOne(
        { userId: userId, lessonId: ObjectId(lessonId) },
        {
            $set: {
                watchedVideos: videoIds,
                allVideosWatched: true,
                completedAt: new Date(),
                updatedAt: new Date()
            },
            $setOnInsert: {
                unlockedAt: new Date(),
                createdAt: new Date()
            }
        },
        { upsert: true }
    );
    
    print("✅ تم إكمال الدرس: " + lesson.title);
    print("📹 عدد الفيديوهات المشاهدة: " + videoIds.length);
    print("📝 تحديث: " + (result.modifiedCount || result.upsertedCount) + " سجل");
}

// ============================================
// ✅ 7. اجتياز اختبار الفئة
// ============================================
function passCategoryQuiz(userId, categoryId, score) {
    if (!userId) userId = TEST_USER_ID;
    if (!userId) {
        print("❌ يجب تعيين معرف المستخدم أولاً!");
        return;
    }
    
    if (!score) score = 80; // افتراضي 80%
    if (score < 60) {
        print("⚠️  الدرجة أقل من 60% - لن يتم اعتبار الفئة مكتملة");
    }
    
    var category = db.categories.findOne({ _id: ObjectId(categoryId) });
    if (!category) {
        print("❌ الفئة غير موجودة!");
        return;
    }
    
    // تحديث تقدم الفئة
    var result = db.category_progress.updateOne(
        { userId: userId, categoryId: ObjectId(categoryId) },
        {
            $set: {
                finalQuizPassed: score >= 60,
                finalQuizBestScore: score,
                completedAt: score >= 60 ? new Date() : null,
                updatedAt: new Date()
            },
            $setOnInsert: {
                unlockedAt: new Date(),
                createdAt: new Date()
            }
        },
        { upsert: true }
    );
    
    if (score >= 60) {
        print("✅ تم اجتياز اختبار الفئة: " + category.title);
        print("📊 النتيجة: " + score + "%");
    } else {
        print("❌ فشل اختبار الفئة: " + category.title);
        print("📊 النتيجة: " + score + "% (يحتاج 60% أو أكثر)");
    }
    print("📝 تحديث: " + (result.modifiedCount || result.upsertedCount) + " سجل");
}

// ============================================
// 🎯 8. سيناريو اختبار كامل
// ============================================
function runFullTestScenario(userId) {
    if (!userId) userId = TEST_USER_ID;
    if (!userId) {
        print("❌ يجب تعيين معرف المستخدم أولاً!");
        return;
    }
    
    print("\n" + "=".repeat(60));
    print("🎯 بدء سيناريو الاختبار الكامل");
    print("=".repeat(60));
    
    // 1. إعادة تعيين
    print("\n1️⃣  إعادة تعيين التقدم...");
    resetUserProgress(userId);
    
    // 2. تهيئة التقدم الأولي
    print("\n2️⃣  تهيئة التقدم الأولي...");
    initializeUserProgress(userId);
    
    // 3. إكمال جميع دروس الفئة الأولى
    print("\n3️⃣  إكمال دروس الفئة الأولى...");
    var level1 = db.levels.findOne({ order: 1, isActive: true });
    var category1 = db.categories.findOne({ levelId: level1._id, isActive: true }, { sort: { order: 1 } });
    var lessons = db.lessons.find({ categoryId: category1._id, isActive: true }).sort({ order: 1 }).toArray();
    
    lessons.forEach(function(lesson) {
        completeLesson(userId, lesson._id);
    });
    
    // 4. اجتياز اختبار الفئة
    print("\n4️⃣  اجتياز اختبار الفئة...");
    passCategoryQuiz(userId, category1._id, 85);
    
    // 5. عرض النتيجة النهائية
    print("\n5️⃣  النتيجة النهائية:");
    showUserProgress(userId);
    
    print("\n✅ اكتمل سيناريو الاختبار!");
    print("=".repeat(60));
}

// ============================================
// 📋 9. قائمة المساعدة
// ============================================
function help() {
    print("\n" + "=".repeat(60));
    print("📚 دليل استخدام سكريبتات اختبار التقدم التعليمي");
    print("=".repeat(60));
    print("\nالدوال المتاحة:\n");
    print("1.  showAllLearners()");
    print("    - عرض جميع مستخدمي التعلم");
    print("\n2.  setTestUserId('USER_ID')");
    print("    - تعيين معرف المستخدم للاختبار");
    print("\n3.  showUserProgress(userId)");
    print("    - عرض التقدم الحالي للمستخدم");
    print("\n4.  resetUserProgress(userId)");
    print("    - حذف جميع التقدم للمستخدم");
    print("\n5.  initializeUserProgress(userId)");
    print("    - تهيئة تقدم جديد (Level 1 + الفئة الأولى + الدرس الأول)");
    print("\n6.  completeLesson(userId, 'LESSON_ID')");
    print("    - إكمال درس معين (مشاهدة جميع الفيديوهات)");
    print("\n7.  passCategoryQuiz(userId, 'CATEGORY_ID', score)");
    print("    - اجتياز اختبار الفئة بدرجة معينة (افتراضي 80)");
    print("\n8.  runFullTestScenario(userId)");
    print("    - تشغيل سيناريو اختبار كامل");
    print("\n9.  help()");
    print("    - عرض هذه القائمة");
    print("\n" + "=".repeat(60));
    print("\nمثال على الاستخدام:");
    print("  > load('scripts/test_progress_mongodb.js')");
    print("  > showAllLearners()");
    print("  > setTestUserId('507f1f77bcf86cd799439011')");
    print("  > initializeUserProgress()");
    print("  > showUserProgress()");
    print("=".repeat(60) + "\n");
}

// عرض القائمة عند التحميل
help();

