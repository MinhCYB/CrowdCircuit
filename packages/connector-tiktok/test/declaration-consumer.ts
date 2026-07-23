import {
  TikTokConnector,
  TikTokConnectorError,
  mapTikTokProviderEvent,
  type TikTokProviderClient,
} from "@crowdcircuit/connector-tiktok";
import type { LiveConnector } from "@crowdcircuit/connector-core";

declare const provider: TikTokProviderClient;
const connector: LiveConnector = new TikTokConnector({
  clientFactory: () => provider,
  streamerUniqueId: "streamer",
});
const error = new TikTokConnectorError("failure");
const mapped = mapTikTokProviderEvent("chat", { comment: "hi" }, {
  roomId: null,
  streamerUniqueId: "streamer",
  occurredAt: "2026-07-23T12:00:00.000Z",
});

// @ts-expect-error - clientFactory is required
new TikTokConnector({});

// @ts-expect-error - factory must return the provider port
new TikTokConnector({ clientFactory: () => ({}) });

// @ts-expect-error - provider event kind is finite
mapTikTokProviderEvent("share", {}, {
  roomId: null,
  streamerUniqueId: "streamer",
  occurredAt: "2026-07-23T12:00:00.000Z",
});

// @ts-expect-error - error code is readonly
error.code = "OTHER";

console.log(connector, error, mapped);

