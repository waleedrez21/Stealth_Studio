import FolderDescription from './FolderDescription';

export default function StudySimGuidance({ editable = false }: { editable?: boolean }) {
  return <FolderDescription folder="study-sim" editable={editable} />;
}
