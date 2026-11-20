import { defineComponent } from "vue";

import "./HkDeleteFact.scss";

/**
 * One emphasised key fact inside a {@link HkDeleteGateWindow} message
 * slot. The house rule: EVERY key fact of the thing being deleted — name,
 * per-locale alias, owner, counters, the names of attached resources — is
 * rendered through this tag, so the irreversible act visibly names its
 * target instead of waving at an anonymous blob.
 */
export default defineComponent({
  name: "HkDeleteFact",
  props: {
    /** The fact's label ("名称" / "所有者" / "来源"). */
    label: { type: String, required: true },
    /** The fact's value ("ml-lab" / "demiurge" / "7 个仓库"). */
    value: { type: String, required: true },
  },
  setup(props) {
    return () => (
      <span class="hk-delete-fact">
        <span class="hk-delete-fact-label">{props.label}</span>
        <span class="hk-delete-fact-value">{props.value}</span>
      </span>
    );
  },
});
