import { z } from 'zod';

export const studySimDescription =
  'These scripts are for StudySim only. Do not use them to promote StealthGPT: studying, flashcards and quizzes are StudySim features.';

export const simulationsDescription =
  'Start on camera with the hook. Press Space to reveal the creator’s line, then turn to the tutor simulation and record the animated lesson as it draws. End on the takeaway, keep the cuts quick, and make the StudySim branding visible. Use the linked videos as framing and pacing inspiration.';

export const descriptionFolders = new Set([
  'first-10', 'engagement', 'study-sim', 'general',
  'general--stealthgpt', 'general--humanchatgpt', 'general--affiliate-scripts', 'study-sim--studysim', 'study-sim--rizzmyprofessor', 'simulations',
]);

export const folderDescriptionInput = z.object({
  description: z.string().trim().max(1000, 'Keep the folder description under 1,000 characters.'),
  revision: z.number().int().nonnegative(),
});

export function normalizeFolderDescription(folder, description) {
  return (folder === 'study-sim' || folder.startsWith('study-sim--')) ? description.replace(/\bstudy[ \t]+sim\b/gi, 'StudySim') : description;
}
