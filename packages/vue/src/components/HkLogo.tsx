import { defineComponent, type PropType } from "vue";
import "./HkLogo.scss";

const sizeMap: Record<string, string> = {
  xs: "1.25rem",
  sm: "1.625rem",
  md: "2rem",
  lg: "3.5rem",
  xl: "5rem",
};

const placeholderSvg = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="60%" height="60%">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);

export default defineComponent({
  name: "HkLogo",
  props: {
    src: { type: String, default: undefined },
    alt: { type: String, default: "" },
    size: {
      type: String as PropType<"xs" | "sm" | "md" | "lg" | "xl">,
      default: "md",
    },
    href: { type: String, default: undefined },
  },
  emits: {
    click: (_e: MouseEvent) => true,
  },
  setup(props, { emit }) {
    const logoSize = () => sizeMap[props.size] ?? sizeMap.md;

    const renderLogo = () => {
      if (props.src) {
        return (
          <img
            class="hk-logo__img"
            src={props.src}
            alt={props.alt}
            style={{ width: logoSize(), height: logoSize() }}
          />
        );
      }

      return (
        <div
          class="hk-logo__placeholder"
          style={{
            width: logoSize(),
            height: logoSize(),
          }}
          role="img"
          aria-label={props.alt || "Logo"}
        >
          {props.alt ? (
            <span class="hk-logo__initial">{props.alt.charAt(0).toUpperCase()}</span>
          ) : (
            placeholderSvg
          )}
        </div>
      );
    };

    if (props.href) {
      return () => (
        <a
          class="hk-logo"
          href={props.href}
          onClick={(e: MouseEvent) => emit("click", e)}
          style={{ lineHeight: 0 }}
        >
          {renderLogo()}
        </a>
      );
    }

    return () => (
      <div
        class="hk-logo"
        onClick={(e: MouseEvent) => emit("click", e)}
        style={{ lineHeight: 0 }}
      >
        {renderLogo()}
      </div>
    );
  },
});
