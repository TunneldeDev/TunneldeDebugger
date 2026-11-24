# Scenario coverage registry

Based on the target's `docs/en-us/development/ui-surface-catalog.md`, workspace pages, sidebars and settings sections. Generated with `pnpm docs:coverage` from the shared definitions. Coverage means adapter availability, not manual approval. Remaining presets have N/A reasons in the workbench inspector.

| ID                  | Surface                            | Presets                                  | Targets                              |
| ------------------- | ---------------------------------- | ---------------------------------------- | ------------------------------------ |
| workbench           | Workbench                          | normal, boundary                         | browser, native-mock, native-service |
| hosts               | Host tree and table                | normal, empty, boundary                  | browser, native-mock, native-service |
| host-details        | Host details                       | normal, boundary                         | browser, native-mock, native-service |
| host-transfer       | Host import and export             | normal, boundary                         | browser, native-mock                 |
| connect             | Connection and authentication      | normal, boundary                         | browser, native-mock                 |
| connections         | Connections and quality            | normal, empty, boundary                  | browser, native-mock                 |
| known-hosts         | Known hosts                        | normal, empty, loading, error, boundary  | browser, native-mock                 |
| terminal            | Terminal                           | normal, empty, boundary                  | browser, native-mock, native-service |
| files               | File browser                       | normal, empty, loading, error, boundary  | browser, native-mock, native-service |
| editor              | Editor                             | normal, loading, error, boundary         | browser, native-mock, native-service |
| editor-conflict     | Editor conflict                    | normal, loading, error, boundary         | browser, native-mock                 |
| preview             | File preview                       | normal, loading, error, boundary         | browser, native-mock                 |
| forwarding          | Port forwarding                    | normal, empty, loading, error, boundary  | browser, native-mock                 |
| socks               | SOCKS5                             | normal, empty, loading, error, boundary  | browser, native-mock                 |
| monitor             | Monitoring                         | normal, loading, error, boundary         | browser, native-mock                 |
| processes           | Processes                          | normal, empty, loading, error, boundary  | browser, native-mock                 |
| tasks               | Background tasks and transfers     | normal, empty, boundary                  | browser, native-mock                 |
| output              | Output and diagnostics             | normal, empty, loading, error, boundary  | browser, native-mock                 |
| history             | Command history                    | normal, empty, loading, error, boundary  | browser, native-mock                 |
| plugins             | Plugins and permissions            | normal, empty, boundary                  | browser, native-mock                 |
| plugin-details      | Plugin details                     | normal, boundary                         | browser, native-mock                 |
| plugin-view         | Plugin providers and recovery      | normal, boundary                         | browser, native-mock                 |
| welcome             | Welcome                            | normal, empty, boundary                  | browser, native-mock                 |
| about               | About                              | normal, boundary                         | browser, native-mock                 |
| dialogs             | Confirmations and consent          | normal, boundary                         | browser, native-mock                 |
| menus               | Menus and command palette          | normal, boundary                         | browser, native-mock                 |
| notifications       | Notifications and errors           | normal, boundary                         | browser, native-mock                 |
| forms               | Forms and validation               | normal, empty, error, boundary, disabled | browser, native-mock                 |
| floating            | Floating panels and retained state | normal, boundary                         | browser, native-mock, native-service |
| settings-general    | Settings · general                 | normal, boundary                         | browser, native-mock, native-service |
| settings-network    | Settings · network                 | normal, boundary                         | browser, native-mock, native-service |
| settings-appearance | Settings · appearance              | normal, boundary                         | browser, native-mock, native-service |
| settings-workspace  | Settings · workspace               | normal, boundary                         | browser, native-mock, native-service |
| settings-terminal   | Settings · terminal                | normal, boundary                         | browser, native-mock, native-service |
| settings-shortcuts  | Settings · shortcuts               | normal, boundary                         | browser, native-mock, native-service |
| settings-files      | Settings · files                   | normal, boundary                         | browser, native-mock, native-service |
| settings-editor     | Settings · editor                  | normal, boundary                         | browser, native-mock, native-service |
| settings-monitor    | Settings · monitor                 | normal, boundary                         | browser, native-mock, native-service |
| settings-updates    | Settings · updates                 | normal, boundary                         | browser, native-mock, native-service |
| settings-plugins    | Settings · plugins                 | normal, boundary                         | browser, native-mock, native-service |
| settings-advanced   | Settings · advanced                | normal, boundary                         | browser, native-mock, native-service |
| settings-about      | Settings · about                   | normal, boundary                         | browser, native-mock, native-service |
| settings-habits     | Settings · habits                  | normal, boundary                         | browser, native-mock, native-service |
