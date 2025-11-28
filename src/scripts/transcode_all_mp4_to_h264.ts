// src/scripts/transcode_all_mp4_to_h264.ts
// Use this script to transcode all .mp4 files under a source folder to H.264
// and write them to a destination folder with the same relative structure.
//
// Usage (Windows PowerShell):
// npx ts-node src/scripts/transcode_all_mp4_to_h264.ts "C:\path\to\videos" "C:\path\to\videos_h264"
//
// Requirements:
// - ffmpeg must be installed and accessible as "ffmpeg" in PATH
//   or you can set FFMPEG_PATH in .env to point to the ffmpeg binary.

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { config as loadEnv } from 'dotenv';

loadEnv();

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

function log(...args: any[]) {
  // Simple logger with prefix
  console.log('[transcode]', ...args);
}

// Recursively collect all .mp4 files under a directory
async function collectMp4Files(rootDir: string): Promise<string[]> {
  const result: string[] = [];

  async function walk(currentDir: string) {
    const entries = await fs.promises.readdir(currentDir, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && fullPath.toLowerCase().endsWith('.mp4')) {
        result.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return result;
}

// Run ffmpeg to transcode a single file
function transcodeOne(srcPath: string, dstPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ensure destination directory exists
    const dstDir = path.dirname(dstPath);
    fs.promises
      .mkdir(dstDir, { recursive: true })
      .then(() => {
        const args = [
          '-y', // overwrite without asking
          '-i',
          srcPath,
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          '23',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-movflags',
          '+faststart',
          dstPath,
        ];

        log('ffmpeg', 'input =', srcPath, 'output =', dstPath);

        const child = spawn(FFMPEG_PATH, args, {
          stdio: ['ignore', 'inherit', 'inherit'], // show ffmpeg logs in console
        });

        child.on('error', (err) => {
          reject(err);
        });

        child.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(
              new Error(`ffmpeg exited with code ${code} for file: ${srcPath}`),
            );
          }
        });
      })
      .catch(reject);
  });
}

async function main() {
  const srcRoot = process.argv[2];
  const dstRoot = process.argv[3];

  if (!srcRoot || !dstRoot) {
    console.error(
      'Usage: npx ts-node src/scripts/transcode_all_mp4_to_h264.ts <srcRoot> <dstRoot>',
    );
    process.exit(1);
  }

  const absSrc = path.resolve(srcRoot);
  const absDst = path.resolve(dstRoot);

  log('Source root:', absSrc);
  log('Destination root:', absDst);
  log('Using ffmpeg binary:', FFMPEG_PATH);

  // Collect all .mp4 files under the source root
  log('Scanning for .mp4 files...');
  const files = await collectMp4Files(absSrc);
  log(`Found ${files.length} .mp4 files.`);

  let processed = 0;
  for (const srcPath of files) {
    processed += 1;

    // Preserve the relative path from srcRoot
    const relPath = path.relative(absSrc, srcPath);
    const dstPath = path.join(absDst, relPath);

    log(`(${processed}/${files.length}) Transcoding:`, relPath);
    try {
      await transcodeOne(srcPath, dstPath);
    } catch (err) {
      console.error('[transcode] Error while transcoding', relPath, err);
      // You can choose to break here or continue with next files
      // For now we continue with next files:
      // break;
    }
  }

  log('Done. Processed files:', processed);
}

main().catch((err) => {
  console.error('[transcode] Fatal error:', err);
  process.exit(1);
});
