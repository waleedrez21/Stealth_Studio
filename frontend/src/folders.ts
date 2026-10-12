export const folders = [
  { id: 'first-10', name: 'First 10 Scripts' },
  { id: 'engagement', name: 'Engagement' },
  { id: 'general', name: 'General' },
] as const;
export type FolderId = (typeof folders)[number]['id'];
export function folderId(value: unknown): FolderId {
  return folders.some((f) => f.id === value) ? (value as FolderId) : 'general';
}
export function folderName(value: unknown) {
  return folders.find((f) => f.id === folderId(value))!.name;
}
export function selectedFolder(value: unknown): FolderId | 'all' {
  return folders.some((f) => f.id === value) ? (value as FolderId) : 'all';
}
