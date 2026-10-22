fn main() {
    // Remote webviews require explicit application-command ACL entries, even
    // when the commands are registered in Builder::invoke_handler.
    let manifest = tauri_build::AppManifest::new().commands(&[
        "prepare_movie_player",
        "show_movie_player",
        "show_movie_wall",
        "toggle_movie_fullscreen",
        "set_movie_controls_height",
        "set_movie_viewport",
        "native_movie_window",
    ]);
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(manifest))
        .expect("Movie Night command permission generation failed");
}
