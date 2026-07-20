import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./scss-hook.mjs", pathToFileURL("./"));
