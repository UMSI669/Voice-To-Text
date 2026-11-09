let activeMicrophoneOwner = null;

export function claimMicrophone(owner) {
  if (activeMicrophoneOwner && activeMicrophoneOwner !== owner) {
    throw new Error("Another microphone session is already active.");
  }

  activeMicrophoneOwner = owner;
  return () => {
    if (activeMicrophoneOwner === owner) activeMicrophoneOwner = null;
  };
}

export function getAudioFileMetadata(uri) {
  const filename = uri?.split("/").pop() || "recording.m4a";
  const extension = filename.split(".").pop()?.toLowerCase();
  const mimeType = extension === "wav" ? "audio/wav" : "audio/mp4";

  return { filename, mimeType };
}

export function safeErrorMessage(error, fallback = "Transcription failed.") {
  let message = error instanceof Error ? error.message : fallback;

  if (!message) message = fallback;

  const apiKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY?.trim();
  if (apiKey) message = message.split(apiKey).join("[redacted]");

  return message
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s"']+/gi, "[request URL]")
    .slice(0, 500);
}
