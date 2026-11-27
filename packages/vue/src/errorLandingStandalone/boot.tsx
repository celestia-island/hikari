// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-V4.1-Flash) directed and reviewed by langyo — SySL-1.0 §2.3
// disclosure.
//
// The standalone error landing page's bootstrap — the whole behavior of
// `error-landing.html` in one exported function so the vitest suite can
// drive the EXACT module the build ships (main.ts below only calls it on
// the real document).
//
// The contract this implements lives in the error-landing wave brief
// (SPEC2 §4 B1): one self-contained page that reads the `hk-server-error`
// island and raises the family takeover; actions retry (`location.reload`)
// and home (`/`); a missing or invalid island still renders the family
// card in its neutral shape — status chip gone, generic copy — never a
// blank page. Two invariants shape every choice here:
//
//  * NOTHING is copied from the family modules. The island is read by the
//    real `readServerErrorLanding` (validation and types are
//    serverLanding.ts's), a valid handoff is raised through the real
//    `reportGlobalError` (which mounts the real `HkErrorReportingOverlay`
//    on the document body — card, copy action, toast surface, Home and
//    Retry with their family defaults), and the neutral card composes the
//    real `HkErrorLanding`. `src/errorReporting/errorLandingStandalone.test.ts`
//    pins the built module graph to those exact files so a copy can never
//    silently replace an import.
//
//  * The page is its own host. There is no app shell, no router and no
//    theme engine — the family default light theme (tokens.scss) and the
//    scale/z tokens (scale.scss) are bundled so every `var()` the card
//    reads resolves, and the card's own per-property fallbacks cover the
//    rest (the landing sheet documents that standalone rendering was an
//    explicit design goal of the family card).

import { createApp, defineComponent } from "vue";

import { reportGlobalError } from "../errorReporting";
import {
  HkServerErrorLandingError,
  readServerErrorLanding,
} from "../errorReporting/serverLanding";
import HkButton from "../components/HkButton";
import { HkErrorLanding } from "../components/HkErrorLanding";
import { activeLocale, setLocale, useI18n } from "../i18n/context";
import { detectLocale } from "../i18n/detectLocale";
import { HK_LOCALE_CATALOG } from "../i18n/localeCatalog";

// The family default light theme seeds (`--color-*` channel palette and
// its `--hi-*` / `--c-*` bridges) plus the scale sheet (spacing, radius,
// durations and the `--hk-z-error` band the takeover sits on). Component
// sheets arrive with their components; these two are the page-level
// sheets a host app would normally apply.
import "../tokens.scss";
import "../scale.scss";

/**
 * Locale detection that consults ONLY `navigator.language`. A storage
 * stub stands in for the localStorage read so a standalone page served
 * from a shared origin cannot inherit the stored locale of an unrelated
 * app hosted there (the brief pins this page to the browser language).
 * `detectLocale` touches exactly one member — `getItem` — so the stub
 * satisfies the runtime contract with a null lookup; the double cast is
 * the honest shape of that (a full Storage implementation would be six
 * dead methods).
 */
const NAVIGATOR_ONLY_STORAGE = { getItem: () => null } as unknown as Storage;

/**
 * The neutral family card — what this page shows when the document
 * carries no usable island. Same card, same actions, same design
 * language as the takeover, minus the specifics the island would have
 * provided: no code chip, no HTTP chip, no raw-details pane, no copy
 * action (nothing server-sent to copy), the component's default tone.
 * Everything readable comes from the i18n context, so it localizes like
 * the takeover does.
 */
const NeutralErrorLanding = defineComponent({
  name: "HkErrorLandingNeutral",
  setup() {
    const { t } = useI18n();
    return () => (
      <HkErrorLanding
        title={t("hikari::errors.defaultTitle", "Something went wrong")}
        description={t("hikari::errors.unexpectedDesc", "An unhandled error occurred")}
      >
        {{
          actions: () => [
            <HkButton key="home" size="sm" onClick={() => window.location.assign("/")}>
              {t("hikari::errors.backHome", "Back to home")}
            </HkButton>,
            <HkButton
              key="retry"
              size="sm"
              variant="secondary"
              onClick={() => window.location.reload()}
            >
              {t("hikari::errorBoundary.retry", "Retry")}
            </HkButton>,
          ],
        }}
      </HkErrorLanding>
    );
  },
});

/**
 * Boot the standalone error landing on `doc` — read the island, settle
 * the locale, raise the family takeover for a valid handoff or mount the
 * neutral card for a missing/invalid one. `main.ts` calls this on the
 * real document; the vitest suite calls it on happy-dom documents.
 */
export async function bootErrorLandingPage(doc: Document = document): Promise<void> {
  // The server's handoff, through the family reader — the island element
  // is consumed here (removed) exactly as on every other hikari host.
  const landing = readServerErrorLanding(doc);

  // Locale resolves from the browser language alone, across every locale
  // the hikari catalog speaks, before anything renders.
  await setLocale(
    detectLocale(HK_LOCALE_CATALOG.map((entry) => entry.code), { storage: NAVIGATOR_ONLY_STORAGE }),
  );
  doc.documentElement.lang = activeLocale();

  if (landing) {
    // A valid handoff IS a server error: raise it through the same
    // report path a host uses, so the takeover that mounts is the real
    // family overlay with its built-in card — wire-code chip, HTTP chip,
    // tone by status class, copy action, raw-details pane, Home (/) and
    // Retry (reload) — with zero options overridden.
    reportGlobalError(new HkServerErrorLandingError(landing), "server");
    return;
  }

  // No usable island: still never blank. A dedicated mount root carries
  // the takeover shell class (its sheet is the overlay's), and the
  // neutral card renders inside it.
  const host = doc.createElement("div");
  host.className = "hk-error-reporting-overlay";
  doc.body.appendChild(host);
  createApp(NeutralErrorLanding).mount(host);
}
