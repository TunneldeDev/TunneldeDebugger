export const ACCEPTANCE_RESULTS = {
  pending: "待检查",
  in_progress: "检查中",
  failed: "有问题",
  blocked: "阻塞",
  needs_retest: "待复测",
  fixed: "已修复",
  passed: "通过",
  not_applicable: "不适用",
  duplicate: "重复问题",
  wont_fix: "暂不处理",
} as const;
export const ACCEPTANCE_PRIORITIES = {
  P0: "P0 · 阻断",
  P1: "P1 · 高",
  P2: "P2 · 中",
  P3: "P3 · 低",
  P4: "P4 · 建议",
} as const;
