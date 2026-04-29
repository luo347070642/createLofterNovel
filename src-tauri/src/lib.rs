use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;

struct ServerProcess(Mutex<Option<Child>>);

/// 检测 localhost:3000 是否已经在运行
async fn is_server_running() -> bool {
    reqwest::get("http://localhost:3000").await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

/// 等待 localhost:3000 就绪，最多等 30 秒
async fn wait_for_server() -> bool {
    for _ in 0..60 {
        match reqwest::get("http://localhost:3000").await {
            Ok(resp) if resp.status().is_success() => return true,
            _ => tokio::time::sleep(Duration::from_millis(500)).await,
        }
    }
    false
}

/// 注入到每个窗口的初始化脚本 — 拦截 window.open 转为 Tauri 原生多窗口
const INIT_SCRIPT: &str = r#"
(function() {
    var BASE_URL = 'http://localhost:3000';
    var origOpen = window.open;

    window.open = function(url, target, features) {
        var isBlank = target === '_blank' ||
            (typeof target === 'string' && target.toLowerCase() === '_blank');
        if (isBlank && url && typeof url === 'string') {
            var fullUrl = url;
            if (fullUrl.indexOf('http') !== 0) {
                fullUrl = BASE_URL + (fullUrl.indexOf('/') === 0 ? fullUrl : '/' + fullUrl);
            }
            var label = 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
            try {
                if (window.__TAURI__ && window.__TAURI__.webviewWindow) {
                    var WebviewWindow = window.__TAURI__.webviewWindow.WebviewWindow;
                    var win = new WebviewWindow(label, {
                        url: fullUrl,
                        title: '自动化搜梗+生文工具',
                        width: 1200,
                        height: 800,
                        center: true,
                        resizable: true,
                        minWidth: 600,
                        minHeight: 400,
                        visible: true,
                        focus: true
                    });
                    win.once('tauri://created', function() {
                        console.log('[Tauri] Window created: ' + label);
                    });
                    win.once('tauri://error', function(e) {
                        console.error('[Tauri] Failed to create window:', e);
                    });
                    return win;
                }
            } catch(e) {
                console.error('[Tauri] window.open override error:', e);
            }
        }
        return origOpen.call(this, url, target, features);
    };

    console.log('[Tauri] Multi-window interceptor ready');
})();
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                if is_server_running().await {
                    println!("[Tauri] Express server already running on localhost:3000");
                } else {
                    // 启动 Node.js Express 服务器（生产模式，dev 模式由 beforeDevCommand 处理）
                    println!("[Tauri] Starting Node.js Express server...");
                    let child = Command::new("node")
                        .arg("index.js")
                        .env("TAURI", "1")
                        .spawn();

                    match child {
                        Ok(c) => {
                            println!("[Tauri] Node.js process started, PID: {:?}", c.id());
                            handle.manage(ServerProcess(Mutex::new(Some(c))));
                        }
                        Err(e) => {
                            eprintln!("[Tauri] Failed to start Node.js: {}", e);
                        }
                    }
                }

                println!("[Tauri] Waiting for Express server on localhost:3000...");
                if wait_for_server().await {
                    println!("[Tauri] Express server ready, creating main window...");
                    let w = tauri::WebviewWindowBuilder::new(
                        &handle,
                        "main",
                        tauri::WebviewUrl::External("http://localhost:3000".parse().unwrap()),
                    )
                    .title("自动化搜梗+生文工具")
                    .inner_size(1280.0, 800.0)
                    .min_inner_size(900.0, 600.0)
                    .center()
                    .resizable(true)
                    .initialization_script(INIT_SCRIPT)
                    .build();
                    match w {
                        Ok(_) => println!("[Tauri] Main window created with init script"),
                        Err(e) => eprintln!("[Tauri] Failed to create main window: {}", e),
                    }
                } else {
                    eprintln!("[Tauri] WARNING: Express server did not respond within 30s");
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let label = window.label();
                println!("[Tauri] Close requested: {}", label);
                if label == "main" {
                    if let Some(state) = window.try_state::<ServerProcess>() {
                        if let Some(mut child) = state.0.lock().unwrap().take() {
                            println!("[Tauri] Killing Node.js server process...");
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
