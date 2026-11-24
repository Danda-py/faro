import { Workspace } from "@/components/workspace";

export const dynamic = "force-dynamic";

export default async function RepoPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  return (
    <Workspace owner={decodeURIComponent(owner)} repo={decodeURIComponent(repo)} />
  );
}
