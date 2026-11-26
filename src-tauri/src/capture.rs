use base64::{engine::general_purpose::STANDARD, Engine};
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

type Reply = Arc<Mutex<Option<oneshot::Sender<Result<Vec<u8>, String>>>>>;

fn finish(reply: &Reply, result: Result<Vec<u8>, String>) {
    if let Some(sender) = reply.lock().unwrap().take() {
        let _ = sender.send(result);
    }
}

/// Snapshot the caller's already-rendered WebView, including its cross-origin iframe.
/// No navigation, DOM cloning, script execution, or access to other windows.
#[tauri::command]
pub async fn capture_workbench(window: tauri::WebviewWindow) -> Result<String, String> {
    if window.label() != "main" {
        return Err("Only the workbench can capture its viewport".into());
    }
    let (tx, rx) = oneshot::channel();
    let reply = Arc::new(Mutex::new(Some(tx)));
    window
        .with_webview(move |webview| snapshot(webview, reply))
        .map_err(|error| error.to_string())?;
    let bytes = tokio::time::timeout(std::time::Duration::from_secs(15), rx)
        .await
        .map_err(|_| "WebView capture timed out")?
        .map_err(|_| "WebView capture was interrupted")??;
    if bytes.is_empty() || bytes.len() > 12 * 1024 * 1024 {
        return Err("WebView capture is empty or too large".into());
    }
    Ok(format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
}

#[cfg(target_os = "macos")]
fn snapshot(webview: tauri::webview::PlatformWebview, reply: Reply) {
    use block2::RcBlock;
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSImage};
    use objc2_foundation::{NSDictionary, NSError};
    use objc2_web_kit::{WKSnapshotConfiguration, WKWebView};

    // with_webview runs on the AppKit thread and owns a live WKWebView handle.
    let Some(mtm) = MainThreadMarker::new() else {
        finish(&reply, Err("Snapshot requires the main thread".into()));
        return;
    };
    unsafe {
        let view = &*(webview.inner() as *const WKWebView);
        let config = WKSnapshotConfiguration::new(mtm);
        // WKWebView bounds can include the title-bar safe area, while JS's
        // innerHeight describes only the page viewport. Snapshot that same area.
        let mut bounds = view.bounds();
        let insets = view.safeAreaInsets();
        // WK snapshot coordinates already start at the page origin. Trim the
        // extra extent without translating it, which would clip the page top.
        bounds.size.width -= insets.left + insets.right;
        bounds.size.height -= insets.top + insets.bottom;
        config.setRect(bounds);
        let handler = RcBlock::new(move |image: *mut NSImage, error: *mut NSError| {
            let result = (|| {
                if let Some(error) = error.as_ref() {
                    return Err(error.localizedDescription().to_string());
                }
                let image = image.as_ref().ok_or("WebView returned no image")?;
                let tiff = image.TIFFRepresentation().ok_or("Snapshot has no bitmap")?;
                let bitmap = NSBitmapImageRep::imageRepWithData(&tiff)
                    .ok_or("Cannot decode snapshot bitmap")?;
                let png = bitmap
                    .representationUsingType_properties(
                        NSBitmapImageFileType::PNG,
                        &NSDictionary::new(),
                    )
                    .ok_or("Cannot encode snapshot PNG")?;
                Ok(png.to_vec())
            })();
            finish(&reply, result);
        });
        view.takeSnapshotWithConfiguration_completionHandler(Some(&config), &handler);
    }
}

#[cfg(windows)]
fn snapshot(webview: tauri::webview::PlatformWebview, reply: Reply) {
    use webview2_com::{
        CapturePreviewCompletedHandler,
        Microsoft::Web::WebView2::Win32::COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG,
    };
    use windows::Win32::System::Com::{
        StructuredStorage::CreateStreamOnHGlobal, STATFLAG_NONAME, STATSTG, STREAM_SEEK_SET,
    };

    unsafe {
        let result = (|| -> windows::core::Result<()> {
            let stream = CreateStreamOnHGlobal(Default::default(), true)?;
            let output = stream.clone();
            let completed = reply.clone();
            let handler = CapturePreviewCompletedHandler::create(Box::new(move |status| {
                let result = (|| -> windows::core::Result<Vec<u8>> {
                    status?;
                    let mut stat = STATSTG::default();
                    output.Stat(&mut stat, STATFLAG_NONAME)?;
                    if stat.cbSize == 0 || stat.cbSize > 12 * 1024 * 1024 {
                        return Err(windows::core::Error::from_hresult(windows::core::HRESULT(
                            0x80070057u32 as i32,
                        )));
                    }
                    output.Seek(0, STREAM_SEEK_SET, None)?;
                    let mut bytes = vec![0; stat.cbSize as usize];
                    let mut read = 0;
                    output
                        .Read(
                            bytes.as_mut_ptr().cast(),
                            bytes.len() as u32,
                            Some(&mut read),
                        )
                        .ok()?;
                    bytes.truncate(read as usize);
                    Ok(bytes)
                })();
                finish(&completed, result.map_err(|error| error.to_string()));
                Ok(())
            }));
            webview.controller().CoreWebView2()?.CapturePreview(
                COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG,
                &stream,
                &handler,
            )
        })();
        if let Err(error) = result {
            finish(&reply, Err(error.to_string()));
        }
    }
}

#[cfg(target_os = "linux")]
fn snapshot(webview: tauri::webview::PlatformWebview, reply: Reply) {
    use webkit2gtk::{gio, SnapshotOptions, SnapshotRegion, WebViewExt};
    webview.inner().snapshot(
        SnapshotRegion::Visible,
        SnapshotOptions::INCLUDE_SELECTION_HIGHLIGHTING,
        None::<&gio::Cancellable>,
        move |surface| {
            let result = surface
                .map_err(|error| error.to_string())
                .and_then(|surface| {
                    let mut bytes = Vec::new();
                    surface
                        .write_to_png(&mut bytes)
                        .map_err(|error| error.to_string())?;
                    Ok(bytes)
                });
            finish(&reply, result);
        },
    );
}
