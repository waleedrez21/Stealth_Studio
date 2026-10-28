export const folders = [
  { id: 'first-10', name: 'Starter Scripts' },
  { id: 'engagement', name: 'Engagement' },
  { id: 'study-sim', name: 'Study Sim Scripts' },
  { id: 'general', name: 'StealthGPT Scripts' },
] as const;
export type FolderId = (typeof folders)[number]['id'];
export const subfolders = [
  { id: 'stealthgpt', name: 'StealthGPT' },
  { id: 'humanchatgpt', name: 'Humanchatgpt' },
] as const;
export type SubfolderId = (typeof subfolders)[number]['id'] | '';
export function subfolderId(value: unknown): SubfolderId {
  return subfolders.some((f) => f.id === value) ? (value as SubfolderId) : '';
}
export function scriptFolderName(folder: unknown, subfolder: unknown) {
  const child =
    folderId(folder) === 'general' ? subfolders.find((f) => f.id === subfolder) : undefined;
  return child ? `${folderName(folder)} / ${child.name}` : folderName(folder);
}
export function folderHref(base: string, folder: FolderId, subfolder: SubfolderId = '') {
  return `${base}?folder=${folder}${folder === 'general' && subfolder ? `&subfolder=${subfolder}` : ''}`;
}
export function folderId(value: unknown): FolderId {
  return folders.some((f) => f.id === value) ? (value as FolderId) : 'general';
}
export function folderName(value: unknown) {
  return folders.find((f) => f.id === folderId(value))!.name;
}
export function selectedFolder(value: unknown): FolderId | 'all' {
  return folders.some((f) => f.id === value) ? (value as FolderId) : 'all';
}
