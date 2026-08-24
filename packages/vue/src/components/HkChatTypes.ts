/**
 * Shared chat/LLM types for the hikari chat kit.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Deliberately dependency-light: plain data shapes only, so any service
 * (arona, shittim-chest, …) can map its own store onto these props
 * without importing provider internals.
 *
 * The attachment shapes already live on HkAttachmentModal (upstreamed in
 * an earlier wave) and are re-exported here so this module mirrors the
 * old PlanaChatTypes surface — import everything chat-related from here.
 */

/** Message role — drives bubble alignment and tinting. */
export type HChatRole = "user" | "assistant";

/** Lifecycle of a tool call block. */
export type HToolCallStatus = "pending" | "running" | "done" | "error";

/** Tool call payload rendered by HkToolBlock (also nested in chat messages). */
export interface HToolCall {
  id?: string;
  toolName: string;
  agentType?: string;
  status: HToolCallStatus;
  callText?: string;
  resultText?: string;
  durationMs?: number;
  defaultExpanded?: boolean;
}

/** Voice popup phase — see HkVoiceInputPopup. */
export type HVoicePopupMode = "notConfigured" | "listening" | "transcribing";

/**
 * Voice state fed by the parent (e.g. from a voice-input composable).
 * `open` + `mode` drive the anchored HkVoiceInputPopup; `transcribing`
 * disables the mic button while recognition is running.
 */
export interface HVoiceState {
  open: boolean;
  mode: HVoicePopupMode;
  transcribing?: boolean;
}

/** One model row in the HkTokenUsagePanel per-model breakdown. */
export interface HModelUsageEntry {
  model: string;
  tokenCount: number;
}

/** Read-only cost inputs for HkTokenUsagePanel (USD amounts). */
export interface HModelCosts {
  prompt: number;
  completion: number;
  cached?: number;
}

// Attachment shapes (defined by HkAttachmentModal since the first
// chat-kit wave) — re-exported, not redefined.
export type {
  HAttachmentDetail,
  HAttachmentItem,
  HAttachmentPreviewType,
} from "./HkAttachmentModal";
