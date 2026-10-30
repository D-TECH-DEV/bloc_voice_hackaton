import { notFound } from "next/navigation";
import { callBackend } from "@/lib/backend";
import type { SessionRecap } from "@/lib/recap";
import RecapLive from "../recap-live";

export default async function SessionConversation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recap = await callBackend<SessionRecap>(`/api/v1/relance/voice-sessions/${id}/recap`);
  if (!recap.ok) notFound();
  return (
    <div>
      <h1>
        Conversation — <code>{id}</code>
      </h1>
      <RecapLive sessionId={id} initial={recap.data} />
    </div>
  );
}
