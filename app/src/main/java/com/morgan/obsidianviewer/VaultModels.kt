package com.morgan.obsidianviewer

import android.content.Context
import android.net.Uri
import androidx.documentfile.provider.DocumentFile

data class VaultFile(
    val name: String,
    val relativePath: String,
    val uri: Uri,
    val mimeType: String?,
)

data class VaultNote(
    val file: VaultFile,
    val content: String,
)

data class VaultIndex(
    val notes: List<VaultNote> = emptyList(),
    val assets: List<VaultFile> = emptyList(),
    val snippetCss: String = "",
) {
    fun findNote(target: String): VaultNote? {
        var decoded = target
        repeat(3) {
            val next = Uri.decode(decoded).replace('+', ' ')
            if (next == decoded) return@repeat
            decoded = next
        }
        val clean = decoded
            .substringBefore('#')
            .removeSuffix(".md")
            .replace('\\', '/')
            .trim('/')
        return notes.firstOrNull {
            it.file.relativePath.removeSuffix(".md").equals(clean, ignoreCase = true)
        } ?: notes.firstOrNull {
            it.file.name.removeSuffix(".md").equals(clean.substringAfterLast('/'), ignoreCase = true)
        }
    }

    fun findAsset(target: String): VaultFile? {
        val clean = Uri.decode(target).replace('\\', '/').trim('/')
        return assets.firstOrNull { it.relativePath.equals(clean, ignoreCase = true) }
            ?: assets.firstOrNull { it.name.equals(clean.substringAfterLast('/'), ignoreCase = true) }
    }

    fun foldersIn(parent: String): List<String> {
        val prefix = parent.takeIf { it.isNotEmpty() }?.plus('/') ?: ""
        return (notes.map { it.file.relativePath } + assets.map { it.relativePath })
            .filter { it.startsWith(prefix) }
            .mapNotNull { path ->
                val remainder = path.removePrefix(prefix)
                remainder.substringBefore('/').takeIf { '/' in remainder }
            }
            .distinct()
            .sortedWith(String.CASE_INSENSITIVE_ORDER)
    }

    fun notesIn(folder: String): List<VaultNote> = notes
        .filter { it.file.relativePath.substringBeforeLast('/', "") == folder }
        .sortedBy { it.file.name.lowercase() }

    fun search(query: String): List<VaultNote> {
        val needle = query.trim()
        if (needle.isEmpty()) return notes
        return notes.filter {
            it.file.relativePath.contains(needle, ignoreCase = true) ||
                it.content.contains(needle, ignoreCase = true)
        }
    }
}

fun buildVaultIndex(context: Context, treeUri: Uri): VaultIndex {
    val root = DocumentFile.fromTreeUri(context, treeUri) ?: return VaultIndex()
    val notes = mutableListOf<VaultNote>()
    val assets = mutableListOf<VaultFile>()
    val snippets = mutableListOf<String>()

    fun walk(directory: DocumentFile, parent: String) {
        directory.listFiles().forEach { document ->
            val name = document.name ?: return@forEach
            if (name.startsWith('.') && name != ".obsidian") return@forEach
            val path = if (parent.isEmpty()) name else "$parent/$name"
            when {
                document.isDirectory && name == ".obsidian" -> {
                    document.findFile("snippets")?.takeIf(DocumentFile::isDirectory)?.let {
                        walk(it, ".obsidian/snippets")
                    }
                }
                document.isDirectory -> walk(document, path)
                document.isFile && parent == ".obsidian/snippets" && name.endsWith(".css", true) -> {
                    val css = context.contentResolver.openInputStream(document.uri)
                        ?.bufferedReader()?.use { it.readText() }.orEmpty()
                    snippets += "/* $name */\n$css"
                }
                document.isFile && name.endsWith(".md", ignoreCase = true) -> {
                    val file = VaultFile(name, path, document.uri, document.type)
                    val content = context.contentResolver.openInputStream(document.uri)
                        ?.bufferedReader()
                        ?.use { it.readText() }
                        .orEmpty()
                    notes += VaultNote(file, content)
                }
                document.isFile -> assets += VaultFile(name, path, document.uri, document.type)
            }
        }
    }

    walk(root, "")
    return VaultIndex(notes = notes, assets = assets, snippetCss = snippets.joinToString("\n"))
}
