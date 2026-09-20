import { auth } from "@/lib/auth";
import { capabilitiesFor, restrictionMessage, type CommunityCapabilities, type CommunityState } from "@/lib/community/restrictions";
import { getStanding, isStaffRole } from "./core";
import type { Viewer } from "./queries";

export interface ViewerContext {
  viewer: Viewer | null;
  isStaff: boolean;
  state: CommunityState;
  caps: CommunityCapabilities;
  /** Set when the member is restricted — shown instead of posting forms. */
  restrictionNotice: string | null;
}

const SIGNED_OUT_CAPS: CommunityCapabilities = { canPost: false, canComment: false, canVote: false, canReport: false, canBookmark: false };

/** Who is looking, and what the Community lets them do right now (standing read from the DB, not the session). */
export async function getViewerContext(): Promise<ViewerContext> {
  const session = await auth();
  if (!session?.user) return { viewer: null, isStaff: false, state: "ACTIVE", caps: SIGNED_OUT_CAPS, restrictionNotice: null };
  const viewer: Viewer = { id: session.user.id, role: session.user.role };
  const standing = await getStanding(viewer.id);
  return {
    viewer,
    isStaff: isStaffRole(viewer.role),
    state: standing.state,
    caps: capabilitiesFor(standing),
    restrictionNotice: restrictionMessage(standing),
  };
}
