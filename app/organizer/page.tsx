import { ExtractDemo } from "@/components/organizer/extract-demo";
import { SAMPLE_FLYER_CAPTION } from "@/lib/muse/fixtures/extract";

export default function OrganizerPage() {
  return (
    <>
      <p className="px-4 pt-3 text-[14px] text-muted">
        Placeholder for the organizer flow: Instagram post, drafted event, one-tap confirm.
      </p>
      <ExtractDemo sampleCaption={SAMPLE_FLYER_CAPTION} />
    </>
  );
}
