import { Asset } from "expo-asset";

export async function resolveSampleAudio(assetModule) {
  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error("The bundled audio sample could not be resolved locally.");
  }

  return asset.localUri;
}
