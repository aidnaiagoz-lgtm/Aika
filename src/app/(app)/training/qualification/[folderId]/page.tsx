import { FolderPage } from "../../FolderPage";

export default async function TrainingQualificationFolderPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params;
  return <FolderPage section="qualification" folderId={folderId} />;
}
