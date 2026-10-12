import { Folder, Files } from 'lucide-react';
import { folders, folderId, type FolderId } from './folders';
export default function FolderNav({
  records,
  active = 'all',
  base = '/',
}: {
  records: { folder?: string }[];
  active: FolderId | 'all';
  base?: string;
}) {
  return (
    <nav className="folder-nav" aria-label="Script folders">
      <a
        className={`folder-link ${active === 'all' ? 'active' : ''}`}
        href={base}
        aria-current={active === 'all' ? 'page' : undefined}
      >
        <Files size={20} />
        <span>All scripts</span>
        <span className="folder-count">{records.length}</span>
      </a>
      {folders.map((folder) => (
        <a
          key={folder.id}
          className={`folder-link ${active === folder.id ? 'active' : ''}`}
          href={`${base}?folder=${folder.id}`}
          aria-current={active === folder.id ? 'page' : undefined}
        >
          <Folder size={20} />
          <span>{folder.name}</span>
          <span className="folder-count">
            {records.filter((s) => folderId(s.folder) === folder.id).length}
          </span>
        </a>
      ))}
    </nav>
  );
}
