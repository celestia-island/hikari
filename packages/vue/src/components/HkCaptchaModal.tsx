import { defineComponent, type PropType } from "vue";
import { HModal } from "@celestia-island/hikari";

import { useI18n } from "../i18n/context";

import { HkCaptchaWidget, type HkCaptchaProvider } from "./HkCaptchaWidget";
import "./HkCaptchaModal.scss";

/**
 * HkCaptchaModal — modal host for HkCaptchaWidget.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Opens on demand (at submit time), renders the provider widget, and emits
 * the verification token once the challenge succeeds. Closes itself when
 * the provider reports an error so the caller can surface its own message.
 */
export const HkCaptchaModal = defineComponent({
  name: "HkCaptchaModal",
  props: {
    modelValue: { type: Boolean, default: false },
    siteKey: { type: String, required: true },
    provider: { type: String as PropType<HkCaptchaProvider>, default: "turnstile" },
    scriptUrl: { type: String, default: undefined },
    attempt: { type: Number, default: 0 },
    title: { type: String, default: undefined },
    width: { type: String, default: "30rem" },
  },
  emits: {
    "update:modelValue": (_v: boolean) => true,
    verify: (_token: string) => true,
    error: (_message: string) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    return () => (
      <HModal
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
        title={props.title ?? t("hikari::captcha.title", "Security check")}
        width={props.width}
      >
        <div class="s-captcha-modal">
          <p class="s-captcha-modal-prompt">{t("hikari::captcha.prompt", "Complete the verification below to continue.")}</p>
          {props.modelValue && (
            <HkCaptchaWidget
              siteKey={props.siteKey}
              provider={props.provider}
              scriptUrl={props.scriptUrl}
              attempt={props.attempt}
              onVerify={(token: string) => emit("verify", token)}
              onError={(message: string) => {
                emit("error", message);
                emit("update:modelValue", false);
              }}
            />
          )}
        </div>
      </HModal>
    );
  },
});
