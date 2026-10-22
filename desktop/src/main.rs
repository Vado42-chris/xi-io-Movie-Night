#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(not(target_os = "linux"))]
compile_error!("This provisional native host currently supports Linux/X11 only.");

mod native;

fn main() {
    if native::run().is_err() {
        // Never print webview, IPC, media, or account details.
        eprintln!("Movie Night could not start its native window.");
        std::process::exit(1);
    }
}
