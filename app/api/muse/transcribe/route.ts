import { MAX_AUDIO_BYTES, transcribeAudio } from "@/lib/muse/transcribe";

// POST multipart with an `audio` WAV part. Returns { data: { transcript } }.
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ data: null, error: "Body must be multipart with an audio part" }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size <= 44) {
    return Response.json({ data: null, error: "No audio recorded" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) return Response.json({ data: null, error: "Recording is too long" }, { status: 413 });
  const result = await transcribeAudio(audio);
  if (result.error !== null) return Response.json({ data: null, error: result.error }, { status: 502 });
  return Response.json({ data: { transcript: result.data }, error: null });
}
