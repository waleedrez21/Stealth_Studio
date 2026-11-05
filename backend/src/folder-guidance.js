import { z } from 'zod';

export const studySimDescription =
  'These scripts are for StudySim only. Do not use them to promote StealthGPT: studying, flashcards and quizzes are StudySim features.';

export const descriptionFolders = new Set([
  'first-10', 'engagement', 'study-sim', 'general',
  'general--stealthgpt', 'general--humanchatgpt', 'general--affiliate-scripts',
]);

export const folderDescriptionInput = z.object({
  description: z.string().trim().max(1000, 'Keep the folder description under 1,000 characters.'),
  revision: z.number().int().nonnegative(),
});

export function normalizeFolderDescription(folder, description) {
  return folder === 'study-sim' ? description.replace(/\bstudy[ \t]+sim\b/gi, 'StudySim') : description;
}
