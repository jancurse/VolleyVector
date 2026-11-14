// The entry of the exported dashboard page: the sets and the view are inlined as window.__SETS__ and
// window.__PARAMS__ (see export.ts). It carries the app's stylesheet, follows the viewer's light or dark
// setting on screen, and prints light, as the app's handouts do.
import { createRoot } from "react-dom/client";

import "../../index.css";
import { cx, PAGE_WIDTH } from "../../ui/styles";
import type { ReportSet } from "../types";
import type { Params } from "./params";
import StatsDashboard from "./StatsDashboard";

const media = matchMedia("(prefers-color-scheme: dark)");
const theme = (print = false) => (document.documentElement.dataset.theme = !print && media.matches ? "dark" : "light");

media.addEventListener("change", () => theme());
window.addEventListener("beforeprint", () => theme(true));
window.addEventListener("afterprint", () => theme());
theme();

const { __SETS__: sets, __PARAMS__: params } = window as unknown as {
  __SETS__: ReportSet[];
  __PARAMS__: Params | null;
};
const root = document.getElementById("root");

document.body.className = "min-h-screen bg-bg print:bg-white";

if (root)
  createRoot(root).render(
    <div className={cx("mx-auto px-4 py-6", PAGE_WIDTH)}>
      <StatsDashboard sets={sets} initial={params ?? undefined} showTitle />
    </div>
  );
