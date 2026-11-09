const unavailable =
  "Local Whisper transcription is available in an iOS or Android development build.";

export const onDeviceStt = {
  model: { id: "whisper.cpp/ggml-tiny.en-q5_1", name: "Whisper tiny.en (Q5_1)" },
  capabilities: {
    microphone: false,
    audioFile: false,
    processingLocation: "on-device",
    unavailableReason: unavailable,
  },
  async getModelStatus() {
    return { status: "unavailable", message: unavailable };
  },
  async downloadModel() {
    throw new Error(unavailable);
  },
  async transcribeFile() {
    throw new Error(unavailable);
  },
};
