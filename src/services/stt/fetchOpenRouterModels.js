import { openRouterConfig } from "./openRouterConfig";

export async function fetchOpenRouterModels() {
  const response = await fetch(openRouterConfig.modelsUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${openRouterConfig.apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter model request failed (${response.status}).`);
  }

  const body = await response.json();

  if (!Array.isArray(body.data)) {
    throw new Error("OpenRouter returned an unexpected model-list format.");
  }

  return body.data
    .filter((model) => typeof model.id === "string")
    .map((model) => ({
      id: model.id,
      name: model.name || model.id,
      description: model.description || "",
    }));
}
