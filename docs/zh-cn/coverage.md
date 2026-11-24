# 场景覆盖登记

依据目标仓库 `docs/zh-cn/development/ui-surface-catalog.md`、工作区页面、侧栏和设置分类建立。此表由 `pnpm docs:coverage` 从同一场景定义生成，表示适配范围，不表示人工验收通过。每个条目的剩余预设均有 N/A 原因，在工作台参数区查看。

| ID                  | 界面               | 预设                                     | 目标                                 |
| ------------------- | ------------------ | ---------------------------------------- | ------------------------------------ |
| workbench           | 工作台与分栏       | normal, boundary                         | browser, native-mock, native-service |
| hosts               | 主机树与表格       | normal, empty, boundary                  | browser, native-mock, native-service |
| host-details        | 主机详情           | normal, boundary                         | browser, native-mock, native-service |
| host-transfer       | 主机导入导出       | normal, boundary                         | browser, native-mock                 |
| connect             | 连接与身份验证     | normal, boundary                         | browser, native-mock                 |
| connections         | 连接状态与质量     | normal, empty, boundary                  | browser, native-mock                 |
| known-hosts         | 已知主机           | normal, empty, loading, error, boundary  | browser, native-mock                 |
| terminal            | 终端               | normal, empty, boundary                  | browser, native-mock, native-service |
| files               | 文件浏览           | normal, empty, loading, error, boundary  | browser, native-mock, native-service |
| editor              | 文件编辑器         | normal, loading, error, boundary         | browser, native-mock, native-service |
| editor-conflict     | 编辑冲突           | normal, loading, error, boundary         | browser, native-mock                 |
| preview             | 文件预览           | normal, loading, error, boundary         | browser, native-mock                 |
| forwarding          | 端口转发           | normal, empty, loading, error, boundary  | browser, native-mock                 |
| socks               | SOCKS5             | normal, empty, loading, error, boundary  | browser, native-mock                 |
| monitor             | 监控               | normal, loading, error, boundary         | browser, native-mock                 |
| processes           | 进程列表           | normal, empty, loading, error, boundary  | browser, native-mock                 |
| tasks               | 后台任务与传输     | normal, empty, boundary                  | browser, native-mock                 |
| output              | 输出与诊断         | normal, empty, loading, error, boundary  | browser, native-mock                 |
| history             | 命令历史           | normal, empty, loading, error, boundary  | browser, native-mock                 |
| plugins             | 插件列表与权限     | normal, empty, boundary                  | browser, native-mock                 |
| plugin-details      | 插件详情           | normal, boundary                         | browser, native-mock                 |
| plugin-view         | 插件提供者与恢复   | normal, boundary                         | browser, native-mock                 |
| welcome             | 欢迎               | normal, empty, boundary                  | browser, native-mock                 |
| about               | 关于               | normal, boundary                         | browser, native-mock                 |
| dialogs             | 确认与授权对话框   | normal, boundary                         | browser, native-mock                 |
| menus               | 菜单与命令面板     | normal, boundary                         | browser, native-mock                 |
| notifications       | 通知与错误详情     | normal, boundary                         | browser, native-mock                 |
| forms               | 表单、禁用与验证   | normal, empty, error, boundary, disabled | browser, native-mock                 |
| floating            | 浮动面板与状态保持 | normal, boundary                         | browser, native-mock, native-service |
| settings-general    | 设置 · 常规        | normal, boundary                         | browser, native-mock, native-service |
| settings-network    | 设置 · 网络        | normal, boundary                         | browser, native-mock, native-service |
| settings-appearance | 设置 · 外观        | normal, boundary                         | browser, native-mock, native-service |
| settings-workspace  | 设置 · 工作区      | normal, boundary                         | browser, native-mock, native-service |
| settings-terminal   | 设置 · 终端        | normal, boundary                         | browser, native-mock, native-service |
| settings-shortcuts  | 设置 · 快捷键      | normal, boundary                         | browser, native-mock, native-service |
| settings-files      | 设置 · 文件        | normal, boundary                         | browser, native-mock, native-service |
| settings-editor     | 设置 · 编辑器      | normal, boundary                         | browser, native-mock, native-service |
| settings-monitor    | 设置 · 监控        | normal, boundary                         | browser, native-mock, native-service |
| settings-updates    | 设置 · 更新        | normal, boundary                         | browser, native-mock, native-service |
| settings-plugins    | 设置 · 插件        | normal, boundary                         | browser, native-mock, native-service |
| settings-advanced   | 设置 · 高级与存储  | normal, boundary                         | browser, native-mock, native-service |
| settings-about      | 设置 · 关于        | normal, boundary                         | browser, native-mock, native-service |
| settings-habits     | 设置 · 使用习惯    | normal, boundary                         | browser, native-mock, native-service |
