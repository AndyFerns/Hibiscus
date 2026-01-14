use notify::{Watcher, RecursiveMode, Event};
use std::sync::mpsc::channel;
use tauri::Emitter;

#[tauri::command]
pub fn watch_workspace(path: String, window: tauri::Window) {
    std::thread::spawn(move || {
        let (tx, rx) = channel();

        let mut watcher = match notify::recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("Failed to create watcher: {e}");
                return;
            }
        };

        if let Err(e) = watcher.watch(path.as_ref(), RecursiveMode::Recursive) {
            eprintln!("Failed to watch workspace: {e}");
            return;
        }

        // Keep watcher alive for the duration of the thread
        for res in rx {
            match res {
                Ok(Event { .. }) => {
                    let _ = window.emit("fs-changed", ());
                }
                Err(e) => {
                    eprintln!("Watch error: {e}");
                }
            }
        }
    });
}
