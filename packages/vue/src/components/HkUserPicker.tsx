// 2026-10-10 user direction — the ONE user-selection business component.
//
// Every surface that needs "pick one or more users" renders this field:
// selected members travel as tags (display name + email), and picking
// happens through a search dialog — type a nickname, username or email,
// the injected `search` callback answers from the backend, click a row.
// The dialog is HkModal (a centered window on desktop, the bottom sheet
// on mobile — HkModal's own responsive treatment) with an HkSearchInput
// as its box. Hosts inject the search itself, so the component carries
// zero transport: the panel wires its user-list RPC, another host could
// wire anything that resolves a query to user options.
//
// Semantics (the HkAffixPicker vocabulary): "single" closes on pick and
// replaces the selection; "multi" toggles rows in a working copy and
// commits on Confirm. The field's tag × removes directly — no dialog.
import { computed, defineComponent, ref, watch, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import HkModal, { type ModalAction } from "./HkModal";
import HkSearchInput from "./HkSearchInput";
import "./HkUserPicker.scss";

/** One pickable user. `uid` is the stable identity (what the host stores);
 *  `username`/`email`/`displayName`/`avatarUrl` are display baggage the
 *  field keeps inside its value so hosts never re-fetch to re-render. */
export interface HkUserOption {
  uid: string;
  username: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

/** Primary tag label: the display name when the deployment has one, the
 *  username otherwise — never both stacked (the email line follows). */
function tagTitle(user: HkUserOption): string {
  return user.displayName?.trim() || user.username;
}

export default defineComponent({
  name: "HkUserPicker",
  props: {
    modelValue: { type: Array as PropType<HkUserOption[]>, required: true },
    /** "single" replaces the selection on pick; "multi" accumulates (the
 *  HkAffixPicker mode vocabulary). */
    mode: { type: String as PropType<"single" | "multi">, default: "single" },
    /** Backend search: resolve a query (may be empty — the initial batch)
     *  to user options. Rejections render as a retry hint, never a throw. */
    search: { type: Function as PropType<(query: string) => Promise<HkUserOption[]>>, required: true },
    label: { type: String, default: undefined },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    /** Rows rendered per query — a runaway backend answer cannot turn the
     *  dialog into a thousand-row scroll. */
    maxResults: { type: Number, default: 50 },
  },
  emits: {
    "update:modelValue": (_users: HkUserOption[]) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    const open = ref(false);
    const query = ref("");
    const results = ref<HkUserOption[]>([]);
    const loading = ref(false);
    const failed = ref(false);
    /** Multi-mode working copy — committed only on Confirm. */
    const draft = ref<HkUserOption[]>([]);
    /** Race guard: only the newest in-flight search may write results. */
    let searchToken = 0;

    async function runSearch(q: string) {
      const token = ++searchToken;
      loading.value = true;
      failed.value = false;
      try {
        const found = await props.search(q);
        if (token !== searchToken) return;
        results.value = (found ?? []).slice(0, props.maxResults);
      } catch {
        if (token !== searchToken) return;
        results.value = [];
        failed.value = true;
      } finally {
        if (token === searchToken) loading.value = false;
      }
    }

    const openDialog = () => {
      if (props.disabled) return;
      open.value = true;
    };

    // One search per open, always: the input is keyed per session, so it
    // REMOUNTS on every open (a fresh mount receives modelValue "" and
    // its no-immediate watch fires nothing; the remounted instance also
    // drops any in-flight debounce from the previous session), and the
    // explicit runSearch("") below is the one initial batch. Reopening
    // after a full close MUST search too — HkModal unmounts its content
    // when closed, so no watcher would ever fire (the R3 finding).
    const sessionSeq = ref(0);
    watch(open, (now) => {
      if (!now) return;
      sessionSeq.value += 1;
      query.value = "";
      results.value = [];
      draft.value = [...props.modelValue];
      void runSearch("");
    });

    const onSearch = (q: string) => {
      void runSearch(q);
    };

    const inDraft = (uid: string) => draft.value.some((u) => u.uid === uid);

    const pickRow = (user: HkUserOption) => {
      if (props.mode === "single") {
        open.value = false;
        emit("update:modelValue", [user]);
        return;
      }
      draft.value = inDraft(user.uid)
        ? draft.value.filter((u) => u.uid !== user.uid)
        : [...draft.value, user];
    };

    const confirmDraft = () => {
      open.value = false;
      emit("update:modelValue", draft.value);
    };

    const removeTag = (uid: string) => {
      if (props.disabled) return;
      emit(
        "update:modelValue",
        props.modelValue.filter((u) => u.uid !== uid),
      );
    };

    const dialogTitle = computed(
      () => props.label ?? t("hikari::userPicker.title", "Select users"),
    );

    const dialogActions = computed<ModalAction[] | undefined>(() =>
      props.mode === "multi"
        ? [
            {
              label: t("hikari::messageBox.cancel", "Cancel"),
              variant: "secondary",
              onClick: () => { open.value = false; },
            },
            {
              label: t("hikari::userPicker.confirm", "Confirm"),
              variant: "primary",
              disabled: draft.value.length === 0,
              onClick: confirmDraft,
            },
          ]
        : undefined,
    );

    return () => (
      <div class={{ "hk-user-picker": true, "is-disabled": props.disabled }}>
        {props.label && <div class="hk-user-picker-label">{props.label}</div>}
        <div
          class="hk-user-picker-field"
          role="button"
          tabindex={props.disabled ? -1 : 0}
          aria-disabled={props.disabled}
          aria-label={props.label ?? t("hikari::userPicker.title", "Select users")}
          onClick={openDialog}
          onKeydown={(e: KeyboardEvent) => {
            if (props.disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openDialog();
            }
          }}
        >
          {props.modelValue.map((user) => (
            <span key={user.uid} class="hk-user-picker-tag" title={`${tagTitle(user)} ${user.email ?? ""}`.trim()}>
              <span class="hk-user-picker-tag-body">
                <span class="hk-user-picker-tag-name">{tagTitle(user)}</span>
                {user.email && <span class="hk-user-picker-tag-email">{user.email}</span>}
              </span>
              {!props.disabled && (
                <button
                  type="button"
                  class="hk-user-picker-tag-x"
                  aria-label={`${t("hikari::userPicker.remove", "Remove")} ${tagTitle(user)}`}
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation();
                    removeTag(user.uid);
                  }}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          <span class={{ "hk-user-picker-add": true, "is-placeholder": props.modelValue.length === 0 }}>
            {props.modelValue.length === 0
              ? (props.placeholder ?? t("hikari::userPicker.add", "Select users…"))
              : t("hikari::userPicker.add", "Select users…")}
          </span>
        </div>

        <HkModal
          modelValue={open.value}
          onUpdate:modelValue={(v: boolean) => { open.value = v; }}
          title={dialogTitle.value}
          width="30rem"
          footerActions={dialogActions.value}
        >
          <div class="hk-user-picker-dialog">
            <HkSearchInput
              key={sessionSeq.value}
              modelValue={query.value}
              onUpdate:modelValue={(v: string) => { query.value = v; }}
              onSearch={onSearch}
              debounce={250}
              placeholder={t("hikari::userPicker.searchPlaceholder", "Nickname, username or email")}
            />
            <div class="hk-user-picker-rows" data-state={loading.value ? "loading" : failed.value ? "failed" : results.value.length === 0 ? "empty" : "ready"}>
              {loading.value && (
                <p class="hk-user-picker-note">{t("hikari::userPicker.searching", "Searching…")}</p>
              )}
              {!loading.value && failed.value && (
                <p class="hk-user-picker-note">{t("hikari::userPicker.searchFailed", "The search failed; try again.")}</p>
              )}
              {!loading.value && !failed.value && results.value.length === 0 && (
                <p class="hk-user-picker-note">
                  {query.value.trim()
                    ? t("hikari::userPicker.empty", "No users match this search.")
                    : t("hikari::userPicker.emptyInitial", "Type a nickname, username or email to search.")}
                </p>
              )}
              {!loading.value && results.value.map((user) => (
                <button
                  key={user.uid}
                  type="button"
                  class={{ "hk-user-picker-row": true, "is-selected": props.mode === "multi" && inDraft(user.uid) }}
                  onClick={() => pickRow(user)}
                >
                  <span class="hk-user-picker-row-main">
                    <span class="hk-user-picker-row-name">{tagTitle(user)}</span>
                    {user.email && <span class="hk-user-picker-row-email">{user.email}</span>}
                  </span>
                  {props.mode === "multi" && inDraft(user.uid) && (
                    <span class="hk-user-picker-row-check" aria-hidden>✓</span>
                  )}
                </button>
              ))}
            </div>
            {props.mode === "multi" && draft.value.length > 0 && (
              <p class="hk-user-picker-count">
                {t("hikari::userPicker.selectedCount", "{count} selected").replace("{count}", String(draft.value.length))}
              </p>
            )}
          </div>
        </HkModal>
      </div>
    );
  },
});
