package com.morgan.obsidianviewer

import android.content.Context

enum class ReaderTheme { SYSTEM, LIGHT, DARK }

data class ReaderPreferences(
    val fontSize: Int = 17,
    val lineHeight: Float = 1.7f,
    val horizontalPadding: Int = 12,
    val theme: ReaderTheme = ReaderTheme.SYSTEM,
    val snippetsEnabled: Boolean = true,
)

fun loadReaderPreferences(context: Context): ReaderPreferences {
    val preferences = context.getSharedPreferences("obsidian_viewer", Context.MODE_PRIVATE)
    return ReaderPreferences(
        fontSize = preferences.getInt("reader_font_size", 17),
        lineHeight = preferences.getFloat("reader_line_height", 1.7f),
        horizontalPadding = preferences.getInt("reader_horizontal_padding", 12),
        theme = runCatching {
            ReaderTheme.valueOf(preferences.getString("reader_theme", ReaderTheme.SYSTEM.name).orEmpty())
        }.getOrDefault(ReaderTheme.SYSTEM),
        snippetsEnabled = preferences.getBoolean("reader_snippets", true),
    )
}

fun saveReaderPreferences(context: Context, value: ReaderPreferences) {
    context.getSharedPreferences("obsidian_viewer", Context.MODE_PRIVATE).edit()
        .putInt("reader_font_size", value.fontSize)
        .putFloat("reader_line_height", value.lineHeight)
        .putInt("reader_horizontal_padding", value.horizontalPadding)
        .putString("reader_theme", value.theme.name)
        .putBoolean("reader_snippets", value.snippetsEnabled)
        .apply()
}
