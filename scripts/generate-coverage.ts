import { writeFile, mkdir } from "node:fs/promises";
import { scenarios } from "../shared/scenarios";
for (const locale of ["zh-cn", "en-us"]) {
  const zh = locale === "zh-cn";
  const heading = zh
    ? "# 场景覆盖登记\n\n依据目标仓库 `docs/zh-cn/development/ui-surface-catalog.md`、工作区页面、侧栏和设置分类建立。此表由 `pnpm docs:coverage` 从同一场景定义生成，表示适配范围，不表示人工验收通过。每个条目的剩余预设均有 N/A 原因，在工作台参数区查看。\n\n| ID | 界面 | 预设 | 目标 |\n|---|---|---|---|"
    : "# Scenario coverage registry\n\nBased on the target's `docs/en-us/development/ui-surface-catalog.md`, workspace pages, sidebars and settings sections. Generated with `pnpm docs:coverage` from the shared definitions. Coverage means adapter availability, not manual approval. Remaining presets have N/A reasons in the workbench inspector.\n\n| ID | Surface | Presets | Targets |\n|---|---|---|---|";
  const rows = scenarios.map(
    (s) =>
      `| ${s.id} | ${zh ? s.title : s.titleEn} | ${s.presets.join(", ")} | ${s.targets.join(", ")} |`,
  );
  await mkdir(`docs/${locale}`, { recursive: true });
  await writeFile(
    `docs/${locale}/coverage.md`,
    heading + "\n" + rows.join("\n") + "\n",
  );
}
