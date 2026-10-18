import { zipSync, strToU8 } from 'fflate';

// Packs course files into a zip for the transfer archive writer.
export interface CourseZipFile {
  path: string;
  content: string | Uint8Array;
}

export function buildCourseZip(files: CourseZipFile[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    entries[file.path] = typeof file.content === 'string' ? strToU8(file.content) : file.content;
  }
  return zipSync(entries);
}
