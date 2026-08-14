import { computed, defineComponent, ref, type PropType } from "vue";
import { HButton, useI18n } from "@celestia-island/hikari";
import { solvePow, type PowChallenge, type PowSolution } from "../utils/pow";

export interface AuthSubmitContext {
  /** Solved PoW for the challenge the backend issued (if any). */
  pow?: PowSolution;
  /** Captcha verification token (if the flow requires one). */
  captchaToken?: string | null;
}

/**
 * Submit button with an auth-challenge lifecycle (the plana-ui half of the
 * auth kit; hikari provides the base input variants, the backend provides
 * the challenge/captcha facilities this wraps):
 *
 * 1. `onGetChallenge` (optional) — ask the backend for a `{ seed, bits }`
 *    PoW challenge.
 * 2. Solve it with the built-in `solvePow` (or a custom `solver`).
 * 3. `onCaptcha` (optional) — acquire a captcha verification token.
 * 4. Call `onSubmit` with the assembled `AuthSubmitContext`.
 *
 * While solving, the button shows its own spinner; `loading` stays
 * external so callers can reflect server-side submission progress.
 */
export default defineComponent({
  name: "HkAuthSubmitButton",
  props: {
    label: { type: String, required: true },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    error: { type: String, default: undefined },
    block: { type: Boolean, default: false },
    size: { type: String as () => "sm" | "md" | "lg", default: "md" },
    variant: { type: String as () => "primary" | "secondary" | "ghost", default: "primary" },
    /** Fetch the backend PoW challenge; return null to skip PoW. */
    onGetChallenge: { type: Function as PropType<() => Promise<PowChallenge | null>>, default: undefined },
    /** Custom solver; defaults to the built-in subtle-based solvePow. */
    solver: { type: Function as PropType<(c: PowChallenge) => Promise<number>>, default: undefined },
    /** Acquire a captcha token; return null to skip captcha. */
    onCaptcha: { type: Function as PropType<() => Promise<string | null>>, default: undefined },
    /** Invoked with the assembled challenge context when ready. */
    doSubmit: { type: Function as PropType<(ctx: AuthSubmitContext) => Promise<void>>, required: true },
  },
  emits: {
    error: (_message: string) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const solving = ref(false);

    const busy = computed(() => props.loading || solving.value);

    async function handleClick() {
      if (busy.value) return;
      solving.value = true;
      try {
        const ctx: AuthSubmitContext = { captchaToken: null };
        const challenge = props.onGetChallenge ? await props.onGetChallenge() : null;
        if (challenge && challenge.bits > 0) {
          const solve = props.solver ?? solvePow;
          const counter = await solve(challenge);
          ctx.pow = { seed: challenge.seed, bits: challenge.bits, counter };
        }
        if (props.onCaptcha) {
          ctx.captchaToken = await props.onCaptcha();
        }
        await props.doSubmit(ctx);
      } catch (e) {
        emit("error", e instanceof Error ? e.message : String(e));
      } finally {
        solving.value = false;
      }
    }

    return () => (
      <div class="s-auth-submit">
        <HButton
          variant={props.variant}
          size={props.size}
          block={props.block}
          loading={busy.value}
          disabled={props.disabled || busy.value}
          onClick={() => void handleClick()}
        >
          {solving.value
            ? t("hikari::auth.solvingChallenge", "Verifying challenge…")
            : props.label}
        </HButton>
        {props.error && <p class="s-auth-submit-error">{props.error}</p>}
      </div>
    );
  },
});
