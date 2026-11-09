# Speech-to-text demo

A JavaScript-only Expo app comparing the phone's operating-system speech service, AI local (Whisper inference), and OpenRouter transcription. 
Completed responses and transcription errors from every page are collected in two small Redux Toolkit slices.

## Current implementation status

- **Shared app/UI:** five Expo Router tabs, JavaScript/JSX screens, Redux store, WAV picker/playback, comparison utility, logs, and model-list UI are implemented.
- **Phone-native:** iOS microphone and file recognition are implemented behind `nativeStt.ios.js`. The Android adapter is an extension stub. Native file submission uses separate converted WAV copies for iOS 17+; the originals remain available to Cloud AI and On-device AI.
- **On-device AI:** iOS `whisper.rn@0.7.4` inference is implemented using the local Whisper `tiny.en` Q5_1 model. The model is downloaded explicitly to the app's document directory. Android is an extension stub.
- **Cloud AI:** the OpenRouter model cache, selection UI, and user-approved `expo/fetch` + `FormData` upload adapter are implemented. The adapter posts the selected local file and model to `/audio/transcriptions`; the model-list endpoint was checked and returned the documented `data` array. **No app audio transcription request has been sent**; the upload path still needs a physical-device test and explicit charge authorization.
- **Physical-device testing:** none of the native paths have been tested on a physical iPhone in this workspace. Do not treat this implementation status as device verification.
- **Sample references:** the four existing WAV files and their provided expected transcripts are configured. WER is calculated against those references.

## Platform and dependency choices

| Integration | Package/version | Current app implementation |
| --- | --- | --- |
| Expo / React Native | Expo `~58.0.23`, React Native `0.88.1` | Existing project versions retained |
| Navigation | `expo-router ~58.0.30` | Five shared tabs in `src/app/(tabs)/` |
| Audio capture/playback | `expo-audio ~58.0.11` | Microphone produces a PCM WAV file; sample playback uses the existing WAVs |
| Files / assets | `expo-file-system ~58.0.13`, `expo-asset ~58.0.20` | Bundled samples resolve to local URIs; temporary recordings are deleted |
| Phone-native speech | `expo-speech-recognition 58.0.1` | iOS implementation; OS processing may be local or remote. Android adapter is a stub. |
| Local speech model | `whisper.rn 0.7.4` | iOS Whisper tiny.en Q5_1 inference. Android adapter is a stub. |
| Cloud speech transport | `expo/fetch` and `expo-file-system ~58.0.13` | Expo-native multipart file upload to OpenRouter |
| Redux | `@reduxjs/toolkit 2.14.0`, `react-redux 9.3.1` | In-memory transcription logs and OpenRouter model cache |

Expo Router, Expo Audio, Expo FileSystem, Expo Asset, speech recognition, and Whisper native modules require an **Expo development build**. Expo Go is not the target. SDK 58's official docs list `expo-speech` as text-to-speech; this app does not use it for recognition.

### Audio formats and platform limitations

- The original bundled audio files (`Audio1-order-confirmation.wav`, `Audio2-reschedule.wav`, `Audio3-luggage.wav`, and `Audio4-cups-in-fake-boston.wav`) are WAV, PCM, 16-bit, stereo, 48 kHz. They are retained unchanged for Cloud AI, On-device AI, playback, and expected-text comparison.
- Each original has a separate `*-16k-mono.wav` copy, created with FFmpeg as 16 kHz, mono, 16-bit PCM WAV. These are stored beside the originals and are selected only for Phone-native sample transcription.
- `whisper.rn`'s current WAV decoder accepts 16-bit PCM, downmixes multi-channel audio, and resamples to Whisper's expected rate. The bundled WAV files therefore use the library's local WAV path without replacement or lossy conversion.
- Microphone audio uses the SDK 58 `AudioStream` file-recording API with PCM WAV, requested as 16 kHz, mono, signed 16-bit. The app displays the format returned by the recorder; actual sample rate can vary by device.
- `expo-speech-recognition` documents iOS and Android prerecorded-file transcription. Its verified iOS input format is 16 kHz mono 16-bit PCM WAV. The sample picker uses the converted copy only when Phone-native is selected; other engines continue using the original files.
- `whisper.rn` receives WAV file URIs. Its local model is `ggml-tiny.en-q5_1.bin` (English, approximately 32 MB), stored in app documents. Model download is user initiated and reports progress and failure.
- The OpenRouter transcription endpoint receives the local WAV file in a multipart `file` field and the selected model in a `model` field. The app does not set multipart `Content-Type` manually; Expo fetch supplies the boundary. This matches the successful cURL route and fields, but the Expo multipart upload itself still needs physical-device verification.
- Targeted implementation is iOS first. Android microphone capture infrastructure is cross-platform, but the native speech and local Whisper adapters intentionally return unavailable until their Android behavior is implemented and tested.

## Install and run

Requirements: Node.js 22.13 or later, npm, and Xcode with iOS command-line tools for a local iOS build. Use a physical iPhone for the native speech and local inference checks.

```sh
npm install
npx expo start
```

Build and install the native development client on a connected iPhone:

```sh
npx expo run:ios --device
```
iPhone emulator
```sh
npx expo run:ios
```


Build and install the native development client on a connected Android:

```sh
npx expo run:ios --device
```
Android emulator
```sh
npx expo run:ios
```


For cloud development builds, Expo's development-build docs also support EAS Build. Use the project's iOS bundle identifier (`ios.bundleIdentifier` in `app.json`) and your Apple developer signing setup. Native dependency or config-plugin changes require a new development build.

## OpenRouter classroom configuration

Copy `.env.example` to `.env`, provide an OpenRouter key, and keep the configured base URL unless using a compatible endpoint:

*THE OPENROUTER KEY IS NOT THE SAME AS YOUR CLASSROOM CODEX KEY*
Note: There's no 100% free transcription model, but some are so low priced they are effectively free.
```dotenv
EXPO_PUBLIC_OPENROUTER_API_KEY=an-openrouter-key
EXPO_PUBLIC_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

Restart the Expo development server after changing `.env`. Without a key, both Cloud AI locations remain visible, show the required configuration message and missing variable name, and do not fetch models or submit audio.

> **Classroom demonstration only — not production-safe.** Expo public environment variables are embedded in the client app and can be extracted. Gitignoring `.env` does not protect a key included in a build. Production provider keys must be held on a backend.

Cloud transcription is user initiated. It uses the OpenRouter `/audio/transcriptions` endpoint; the adapter appends the route to the configured API base URL. Model selection comes from the shared in-memory Redux cache populated from `/models?output_modalities=transcription`; cache freshness is one hour. Clearing logs does not clear models.

No audio upload is started automatically. A user presses Transcribe or Stop and transcribe. An actual cloud request may incur provider charges.

## Local Whisper model

The On-device AI screen downloads `ggml-tiny.en-q5_1.bin` from the `ggerganov/whisper.cpp` Hugging Face repository to the app's document directory on request. It is a quantized GGML/whisper.cpp model, not a hosted OpenAI model or an OpenRouter model. Inference is performed by `whisper.rn` on-device; there is no cloud fallback. The app requires a non-truncated downloaded model file before enabling microphone/sample inference.

The current iOS adapter disables Core ML model loading because only the `.bin` model is provisioned. `whisper.rn` can use its supported native acceleration/fallback behavior. Performance and memory use need measurement on the target classroom phone.

## Samples and expected text

Sample metadata and static Metro `require()` declarations live in `src/data/audioSamples.js`. Each entry has the original `asset`/`filename` and a Phone-native-only `phoneNativeAsset`/`phoneNativeFilename`. To add another WAV:

1. Add the WAV under `assets/audio/`.
2. Add one array entry with a unique `id`, exact `filename`, static `require()` call, and language.
3. Add a separate Phone-native conversion at 16 kHz, mono, 16-bit PCM WAV with its own static `require()` call.
4. Fill `expectedText` from the actual recording if WER comparison is wanted.

WER lowercases, removes Unicode punctuation, collapses whitespace, and computes word-level Levenshtein distance divided by expected-word count. An empty reference returns `null`; WER is allowed to exceed 100%. Capitalization and punctuation are ignored. WER is not labeled as general accuracy.

## Redux teaching model

There is no persistence, RTK Query, saga, generic request framework, or typed hooks. Recording flags, partial transcripts, model-download progress, and current UI results remain in component state.

```text
Any transcription page
    → dispatch(sttResponseReceived(entry))
    → Redux stores the entry
    → Logs page reads it with useSelector
```

`sttLogs` holds JSON-serializable completed successes/errors newest-first. `openRouterModels` holds one cached transcription-model list and one shared model selection. Neither slice stores audio, SDK result instances, native handles, promises, credentials, or partial recognition callbacks.

## Adapter boundaries and Android extension points

The route components and Redux are platform-neutral. Pages call the `sttAdapters` registry from `src/services/stt/index.js` using `transcribeFile({ uri, filename, mimeType, language, model, signal })` or the live `nativeStt.startListening/stopListening/cancelListening` contract.

Metro resolves `nativeStt.ios.js` and `onDeviceStt.ios.js` on iOS. `nativeStt.android.js` and `onDeviceStt.android.js` are explicit unavailable adapters with the same interface. To add Android support, implement those platform-specific modules and report verified capabilities there; the shared screens, Redux slices, model cache, WAV sample list, and cloud adapter do not need platform checks or rewrites.

Phone-native recognition does not imply local processing. The iOS adapter leaves `requiresOnDeviceRecognition` false so platform service behavior determines where processing occurs.

## Checks and manual verification

```sh
npx expo lint
npx tsc --noEmit
npx expo-doctor
```

This classroom demo does not include an automated test suite. Physical-device checks are still required for:

- iOS operating-system microphone recognition, permission denial, repeated final event handling, and navigation cleanup.
- Phone-native transcription of the converted 16 kHz mono WAV copies on an iOS 17+ physical device.
- Local Whisper tiny.en model download, inference from microphone WAV and all four current sample WAVs, cancellation, and memory/performance.
- Cloud model-list UI with credentials and an authorized cloud WAV request using `qwen/qwen3-asr-0.6b`, followed by authorized microphone transcription.
- Expo fetch/FormData upload and OpenRouter response parsing on a physical phone, with an authorized cloud request.
- Empty/error model lists, missing `.env`, and retry/manual-refresh behavior in the built app.

## Implementation notes

- React and React DOM are `19.3.0`, matching Expo SDK 58. Expo `~58.0.23` and React Native `0.88.1` were not changed.
- The OpenRouter model-list URL was queried without sending an audio file; its live response used a `data` array and included `qwen/qwen3-asr-0.6b`.
- In the installed OpenAI SDK, `transcribe` accepted the documented `Uint8Array`, but its OpenAI adapter attempted to create `new Blob([audio])`. React Native 0.88's Blob implementation rejects `ArrayBufferView`, before a request reaches OpenRouter. The user approved Expo fetch/FormData as the explicit transport fallback; `ai` and `@ai-sdk/openai` are not app dependencies.
- `npx expo export --platform ios` completed after the `buffer` package was added to the project. Metro emitted a nonfatal `whisper.rn` root-export warning and fell back to file-based resolution.
- Unresolved verification: native CocoaPods install/build, physical iPhone recognition/inference, microphone runtime recording format, root redirect on the simulator, and live Expo FormData upload/response parsing. Expo Doctor currently reports that it cannot determine the CocoaPods version.
