import { FolderPage } from "../../FolderPage";

export default async function TrainingProvisionFolderPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params;
  return <FolderPage section="provision" folderId={folderId} />;
}
