#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod capture;

use tauri::{LogicalPosition, LogicalSize, Manager};

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![capture::capture_workbench])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                // Fit the complete decorated window inside this monitor's work area,
                // accounting for Retina scaling, the menu bar and the Dock.
                if let Some(monitor) = window.current_monitor()?.or(window.primary_monitor()?) {
                    let factor = monitor.scale_factor();
                    let work = monitor.work_area();
                    let outer = window.outer_size()?;
                    let inner = window.inner_size()?;
                    let decoration_width = outer.width.saturating_sub(inner.width) as f64 / factor;
                    let decoration_height =
                        outer.height.saturating_sub(inner.height) as f64 / factor;
                    let available_width =
                        (work.size.width as f64 / factor - 48.0 - decoration_width).max(1.0);
                    let available_height =
                        (work.size.height as f64 / factor - 48.0 - decoration_height).max(1.0);
                    let width = available_width.min(1280.0);
                    let height = available_height.min(820.0);
                    window.set_min_size(Some(LogicalSize::new(
                        width.min(760.0),
                        height.min(480.0),
                    )))?;
                    window.set_size(LogicalSize::new(width, height))?;
                    window.set_position(LogicalPosition::new(
                        work.position.x as f64 / factor
                            + (work.size.width as f64 / factor - width - decoration_width) / 2.0,
                        work.position.y as f64 / factor
                            + (work.size.height as f64 / factor - height - decoration_height) / 2.0,
                    ))?;
                }
                window.show()?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run TunneldeDebugger");
}
