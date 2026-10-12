import { Folder, Files } from 'lucide-react';
import {
  folders,
  folderId,
  subfolderId,
  subfolders,
  folderHref,
  type FolderId,
  type SubfolderId,
} from './folders';
export default function FolderNav({
  records,
  active = 'all',
  base = '/',
  child = '',
}: {
  records: { folder?: string; subfolder?: string }[];
  active: FolderId | 'all';
  base?: string;
  child?: SubfolderId;
}) {
  return (
    <>
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
      {active === 'general' && (
        <nav className="subfolder-nav" aria-label="StealthGPT Scripts subfolders">
          <span className="subfolder-heading">StealthGPT Scripts</span>
          <a
            className={`subfolder-link ${!child ? 'active' : ''}`}
            href={folderHref(base, 'general')}
            aria-current={!child ? 'page' : undefined}
          >
            All in this folder
          </a>
          {subfolders.map((f) => (
            <a
              key={f.id}
              className={`subfolder-link ${child === f.id ? 'active' : ''}`}
              href={folderHref(base, 'general', f.id)}
              aria-current={child === f.id ? 'page' : undefined}
            >
              <Folder size={16} />
              {f.name}
              <span className="folder-count">
                {
                  records.filter(
                    (s) => folderId(s.folder) === 'general' && subfolderId(s.subfolder) === f.id,
                  ).length
                }
              </span>
            </a>
          ))}
        </nav>
      )}
    </>
  );
}
