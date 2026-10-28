import { z } from 'zod';

export const studySimDescription =
  'These scripts are for Study Sim only. Do not use them to promote StealthGPT: studying, flashcards and quizzes are Study Sim features.';

export const folderDescriptionInput = z.object({
  description: z.string().trim().max(1000, 'Keep the folder description under 1,000 characters.'),
  revision: z.number().int().nonnegative(),
});
