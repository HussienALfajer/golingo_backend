// src/scripts/upload_wlasl_to_b2.ts
// Comments in English as requested

import { config as loadEnv } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

loadEnv();

interface CategoryConfig {
  name_en: string;
  name_ar: string;
  glosses: string[];
}

interface LevelConfig {
  name_en: string;
  name_ar: string;
  categories: Record<string, CategoryConfig>;
}

interface LevelsConfig {
  [levelCode: string]: LevelConfig;
}

interface WlaslInstance {
  video_id: string;
  split?: string;
  fps?: number;
  signer_id?: string;
}

interface WlaslGloss {
  gloss: string;
  instances: WlaslInstance[];
}

async function main() {
  // 0) Get CLI args
  // Usage: ts-node upload_wlasl_to_b2.ts <LEVEL_CODE> <WLASL_JSON_PATH> <VIDEOS_FOLDER>
  const levelCode = (process.argv[2] || 'L1').toUpperCase();
  const wlaslJsonPath =
    process.argv[3] ||
    path.join(__dirname, '..', '..', '..', 'data', 'WLASL_v0.3.json');
  const videosFolder =
    process.argv[4] || path.join(__dirname, '..', '..', '..', 'data', 'videos');

  console.log('[upload_wlasl_to_b2] Level code:', levelCode);
  console.log('[upload_wlasl_to_b2] Using WLASL JSON:', wlaslJsonPath);
  console.log('[upload_wlasl_to_b2] Using videos folder:', videosFolder);

  // 1) Read env variables for Backblaze S3
  const bucket = process.env.STORAGE_BUCKET;
  const endpoint = process.env.AWS_S3_ENDPOINT;
  const region = process.env.AWS_REGIONs || 'us-west-002';

  if (!bucket || !endpoint) {
    throw new Error('Missing STORAGE_BUCKET or AWS_S3_ENDPOINT in .env');
  }

  // 2) Create S3 client for Backblaze
  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_IDs!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEYs!,
    },
  });

  // 3) Load levels config (L1..L5)
  const levelsConfigPath = path.join(
    __dirname,
    '..',
    'config',
    'wlasl_levels.json',
  );
  console.log(
    '[upload_wlasl_to_b2] Loading levels config from:',
    levelsConfigPath,
  );

  const levelsRaw = fs.readFileSync(levelsConfigPath, 'utf8');
  const levelsConfig: LevelsConfig = JSON.parse(levelsRaw);

  const levelConfig = levelsConfig[levelCode];
  if (!levelConfig) {
    throw new Error(`Level ${levelCode} not found in wlasl_levels.json`);
  }

  // 4) Build map from gloss -> categorySlug for this level
  const glossToCategory = new Map<string, string>();

  for (const [categorySlug, category] of Object.entries(
    levelConfig.categories,
  )) {
    for (const gloss of category.glosses) {
      glossToCategory.set(gloss.toLowerCase(), categorySlug);
    }
  }

  console.log(
    `[upload_wlasl_to_b2] Level ${levelCode} has`,
    glossToCategory.size,
    'glosses mapped to categories.',
  );

  // 5) Load WLASL_v0.3.json
  const wlaslRaw = fs.readFileSync(wlaslJsonPath, 'utf8');
  const wlaslData: WlaslGloss[] = JSON.parse(wlaslRaw);

  // 6) Iterate over gloss entries
  for (const glossEntry of wlaslData) {
    const gloss = (glossEntry.gloss || '').toLowerCase();
    const categorySlug = glossToCategory.get(gloss);

    // Skip glosses that are not part of this level config
    if (!categorySlug) continue;

    for (const inst of glossEntry.instances) {
      const videoId = String(inst.video_id);
      const localFile = path.join(videosFolder, `${videoId}.mp4`);

      if (!fs.existsSync(localFile)) {
        console.warn(
          '[upload_wlasl_to_b2] Local video not found, skipping:',
          localFile,
        );
        continue;
      }

      // Build B2 key: asl/<LEVEL_CODE>/<category>/<gloss>/<videoId>.mp4
      const b2Key = `asl/${levelCode}/${categorySlug}/${gloss}/${videoId}.mp4`;

      console.log('[upload_wlasl_to_b2] Uploading', localFile, '->', b2Key);

      const body = fs.createReadStream(localFile);

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: b2Key,
          Body: body,
          ContentType: 'video/mp4',
        }),
      );
    }
  }

  console.log(
    `[upload_wlasl_to_b2] Finished uploading videos for level ${levelCode} to Backblaze.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
