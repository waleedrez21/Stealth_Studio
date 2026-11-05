export const folders = [
  { id: 'first-10', name: 'Starter Scripts' },
  { id: 'engagement', name: 'Engagement' },
  { id: 'study-sim', name: 'StudySim' },
  { id: 'general', name: 'StealthGPT Scripts' },
] as const;
export type FolderId = (typeof folders)[number]['id'];
const subfolders = [
  { parent: 'general', id: 'stealthgpt', name: 'StealthGPT' },
  { parent: 'general', id: 'humanchatgpt', name: 'Humanchatgpt' },
  { parent: 'general', id: 'affiliate-scripts', name: 'Affiliate Scripts' },
  { parent: 'study-sim', id: 'rizzmyprofessor', name: 'RizzMyProfessor' },
] as const;
export type SubfolderId = (typeof subfolders)[number]['id'] | '';
export function subfoldersFor(parent: FolderId | 'all') {
  return subfolders.filter(f => f.parent === parent);
}
export function subfolderId(value: unknown, parent: FolderId | 'all'): SubfolderId {
  return subfoldersFor(parent).find(f => f.id === value)?.id ?? '';
}
export function scriptFolderName(folder: unknown, subfolder: unknown) {
  const child = subfoldersFor(folderId(folder)).find(f => f.id === subfolder);
  return child ? `${folderName(folder)} / ${child.name}` : folderName(folder);
}
export function folderHref(base: string, folder: FolderId, subfolder: SubfolderId = '') {
  const child = subfolderId(subfolder, folder);
  return `${base}?folder=${folder}${child ? `&subfolder=${child}` : ''}`;
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
