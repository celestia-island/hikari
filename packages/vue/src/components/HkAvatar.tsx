import { computed, defineComponent, type PropType } from "vue";
import { useI18n } from "../i18n/context";
import { useAvatarImage } from "./avatarImage";
import "./HkAvatar.scss";

export default defineComponent({
  name: "HkAvatar",
  props: {
    src: { type: String },
    name: { type: String },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
  },
  setup(props) {
    const { t } = useI18n();
    const cls = computed(() => [
      "hk-avatar",
      `hk-avatar-${props.size}`,
    ]);
    // A stored URL is not a guarantee: the blob can 404 (deleted upload,
    // external provider unreachable, mirror cold). The failed-load latch
    // swaps the broken <img> for the SAME letter chip the absent-src branch
    // renders, so the roster never shows a browser broken-picture glyph.
    const avatar = useAvatarImage(() => props.src);

    return () => (
      <div class={cls.value}>
        {avatar.src.value ? (
          <img src={avatar.src.value} alt={props.name} onError={avatar.onError} />
        ) : (
          <span class="hk-avatar-fallback">{props.name?.charAt(0)?.toUpperCase() ?? t("hikari::avatar.fallback", "?")}</span>
        )}
      </div>
    );
  },
});
