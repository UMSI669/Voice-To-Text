const unavailable = "Phone-native speech recognition is available in iOS and Android development builds.";

export const nativeStt = {
  capabilities: {
    microphone: false,
    audioFile: false,
    processingLocation: "system-service",
    unavailableReason: unavailable,
    audioFileUnavailableReason: unavailable,
  },
  async getAvailability() {
    return { available: false, message: unavailable };
  },
  async startListening() {
    throw new Error(unavailable);
  },
  async stopListening() {},
  async cancelListening() {},
  async transcribeFile() {
    throw new Error(unavailable);
  },
};
