import { cloudStt } from "./cloudStt";
import { nativeStt } from "./nativeStt";
import { onDeviceStt } from "./onDeviceStt";

export const sttAdapters = {
  "phone-native": nativeStt,
  "phone-ai": onDeviceStt,
  "cloud-ai": cloudStt,
};

export const engineNames = {
  "phone-native": "Phone-native",
  "phone-ai": "On-device AI",
  "cloud-ai": "Cloud AI",
};
