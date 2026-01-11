use notify::{Watcher, RecursiveMode, Event};
use std::sync::mpsc::channel;

#[tauri::command]
pub fn watch_workspace(path: String, window: tauri::Window) {
    std::thread::spawn(move || {
        let (tx, rx) = channel();
        let mut watcher = notify::recommended_watcher(tx).unwrap();

        watcher.watch(path.as_ref(), RecursiveMode::Recursive).unwrap();

        for res in rx {
            if let Ok(Event { .. }) = res {
                let _ = window.emit("fs-changed", {});
            }
        }
    });
}
