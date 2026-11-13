import { InstagramDm } from "@/components/demo/instagram-dm";

// Demo beat U2a, staged: Lisa (no Facebook account) gets an Instagram message
// from Aaron. The invite in it is real: Aaron's Muse wrote and sent it from the
// map (POST /api/social/invites), and it appears here as it arrives.
export default function StagedInstagramDmPage() {
  return <InstagramDm to="lisa" />;
}
