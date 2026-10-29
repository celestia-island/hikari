import { describe, expect, it } from "vitest";
import * as barrel from "../index";

/**
 * The public barrel guard for HkFaceShell (R3 M6 on PR #900): deleting
 * the export line from index.ts kept the ENTIRE suite green before this
 * pin — every other test reaches the component through the direct
 * "./HkFaceShell" path, so only an external consumer would have noticed.
 * Same shape as theme/themeDecorSurface.test.ts.
 *
 * This file deliberately does NOT mock "@celestia-island/hikari": the
 * package's self-reference resolves to the very same src/index.ts module
 * as "../index", so a vi.mock here would replace the barrel under test
 * with the mock's own namespace (measured: HkFaceShell read as undefined
 * through `...actual` under the re-entrant factory).
 */
describe("the public barrel", () => {
  it("exports HkFaceShell (deleting the line kept the suite green before this pin)", () => {
    // defineComponent's object syntax yields a plain object, so the
    // identity check is the component's own `name`, not typeof.
    const face = barrel.HkFaceShell as unknown as { name?: string };
    expect(face, "HkFaceShell must be re-exported").toBeTruthy();
    expect(face.name).toBe("HkFaceShell");
    // The admin wrapper stays reachable too — the extraction must not
    // move the public surface.
    const admin = barrel.HkAdminShell as unknown as { name?: string };
    expect(admin, "HkAdminShell must stay exported").toBeTruthy();
    expect(admin.name).toBe("HkAdminShell");
  });
});
