package com.morgan.obsidianviewer

import android.net.Uri
import org.commonmark.Extension
import org.commonmark.ext.autolink.AutolinkExtension
import org.commonmark.ext.gfm.strikethrough.StrikethroughExtension
import org.commonmark.ext.gfm.tables.TablesExtension
import org.commonmark.ext.task.list.items.TaskListItemsExtension
import org.commonmark.parser.Parser
import org.commonmark.renderer.html.HtmlRenderer
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

data class RenderedNote(val html: String, val anchor: String?)

object MarkdownRenderer {
    private val extensions: List<Extension> = listOf(
        AutolinkExtension.create(),
        StrikethroughExtension.create(),
        TablesExtension.create(),
        TaskListItemsExtension.create(),
    )
    private val parser = Parser.builder().extensions(extensions).build()
    private val renderer = HtmlRenderer.builder()
        .extensions(extensions)
        .escapeHtml(true)
        // Navigation is allow-listed by VaultWebViewClient; keep the custom obsidian:// scheme.
        .sanitizeUrls(false)
        .build()

    fun render(note: VaultNote, dark: Boolean, index: VaultIndex, requestedAnchor: String? = null): RenderedNote {
        val (frontmatter, markdownBody) = extractFrontmatter(note.content)
        val expanded = expandEmbeds(markdownBody, index, mutableSetOf(note.file.relativePath), 0)
        val linked = rewriteLinks(expanded, note, index)
        var body = renderer.render(parser.parse(linked))
        body = rewriteRenderedLinks(body, note)
        body = rewriteRenderedImages(body, index)
        body = addHeadingIds(body)
        body = addBlockIds(body)
        body = decorateCallouts(body)
        val frontmatterHtml = frontmatter?.let {
            "<details class=\"frontmatter\"><summary>Properties</summary><pre>${escapeHtml(it)}</pre></details>"
        }.orEmpty()
        return RenderedNote(
            html = htmlDocument(frontmatterHtml + body, dark),
            anchor = requestedAnchor?.let(Uri::decode),
        )
    }

    private fun extractFrontmatter(markdown: String): Pair<String?, String> {
        if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) return null to markdown
        val normalized = markdown.replace("\r\n", "\n")
        val end = normalized.indexOf("\n---\n", startIndex = 4)
        if (end < 0) return null to markdown
        return normalized.substring(4, end) to normalized.substring(end + 5)
    }

    private fun expandEmbeds(
        markdown: String,
        index: VaultIndex,
        visited: MutableSet<String>,
        depth: Int,
    ): String {
        if (depth >= 3) return markdown
        return OBSIDIAN_EMBED.replace(markdown) { match ->
            val raw = match.groupValues[1].substringBefore('|').trim()
            val note = index.findNote(raw)
            if (note == null) {
                val asset = index.findAsset(raw)
                if (asset == null) match.value else "![${asset.name}](${vaultImageUrl(asset.relativePath)})"
            } else if (!visited.add(note.file.relativePath)) {
                "> Embedded note cycle: ${note.file.name}"
            } else {
                val (_, embeddedBody) = extractFrontmatter(note.content)
                val rendered = expandEmbeds(embeddedBody, index, visited, depth + 1)
                visited.remove(note.file.relativePath)
                "\n> **${note.file.name.removeSuffix(".md")}**\n>\n" +
                    rendered.lines().joinToString("\n") { "> $it" } + "\n"
            }
        }
    }

    private fun rewriteLinks(markdown: String, note: VaultNote, index: VaultIndex): String {
        var output = WIKI_LINK.replace(markdown) { match ->
            val raw = match.groupValues[1]
            val target = raw.substringBefore('|').trim()
            val label = raw.substringAfter('|', target).substringBefore('#').ifBlank { target.substringBefore('#') }
            val heading = target.substringAfter('#', "")
            val noteTarget = target.substringBefore('#').ifBlank { note.file.relativePath }
            val uri = "obsidian://note?path=${encode(noteTarget)}" +
                heading.takeIf { it.isNotEmpty() }?.let { "&heading=${encode(it)}" }.orEmpty()
            "[$label]($uri)"
        }
        return output
    }

    private fun rewriteRenderedLinks(html: String, note: VaultNote): String = HTML_LINK.replace(html) { match ->
        val beforeHref = match.groupValues[1]
        val destination = match.groupValues[2]
        val replacement = when {
            destination.startsWith("#") -> {
                val heading = Uri.decode(destination.removePrefix("#"))
                "obsidian://note?path=${encode(note.file.relativePath)}&heading=${encode(heading)}"
            }
            isLocalMarkdownDestination(destination) -> {
                val rawPath = destination.substringBefore('#')
                val heading = destination.substringAfter('#', "").let(Uri::decode)
                val resolved = resolveRelativeNotePath(note.file.relativePath, Uri.decode(rawPath))
                "obsidian://note?path=${encode(resolved)}" +
                    heading.takeIf { it.isNotEmpty() }?.let { "&heading=${encode(it)}" }.orEmpty()
            }
            else -> destination
        }
        "<a$beforeHref href=\"${escapeAttribute(replacement)}\""
    }

    private fun rewriteRenderedImages(html: String, index: VaultIndex): String = HTML_IMAGE.replace(html) { match ->
        val beforeSrc = match.groupValues[1]
        val source = match.groupValues[2]
        if (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("data:")) {
            match.value
        } else {
            val asset = index.findAsset(Uri.decode(source)) ?: return@replace match.value
            "<img$beforeSrc src=\"${escapeAttribute(vaultImageUrl(asset.relativePath))}\""
        }
    }

    private fun addHeadingIds(html: String): String = HEADING.replace(html) { match ->
        val level = match.groupValues[1]
        val content = match.groupValues[2]
        val plain = content.replace(HTML_TAG, "")
        "<h$level id=\"${escapeAttribute(plain)}\">$content</h$level>"
    }

    private fun addBlockIds(html: String): String = BLOCK_ID.replace(html) { match ->
        "<span class=\"block-id\" id=\"^${match.groupValues[1]}\"></span>"
    }

    private fun decorateCallouts(html: String): String = CALLOUT.replace(html) { match ->
        val type = match.groupValues[1].lowercase()
        val title = match.groupValues[2].ifBlank { type.replaceFirstChar(Char::uppercase) }
        "<blockquote class=\"callout $type\"><strong>$title</strong>${match.groupValues[3]}</blockquote>"
    }

    private fun htmlDocument(body: String, dark: Boolean): String {
        val background = if (dark) "#121212" else "#fafafa"
        val foreground = if (dark) "#e6e1e5" else "#242424"
        val secondary = if (dark) "#cac4d0" else "#555"
        val border = if (dark) "#49454f" else "#ddd"
        val code = if (dark) "#242126" else "#f1eff3"
        return """<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{color-scheme:${if (dark) "dark" else "light"}}*{box-sizing:border-box}body{margin:0;padding:8px 2px 80px;background:$background;color:$foreground;font:17px/1.7 system-ui,sans-serif;overflow-wrap:anywhere}h1,h2,h3,h4{line-height:1.3;margin:1.25em 0 .5em;scroll-margin-top:12px}h1{font-size:2em}h2{font-size:1.55em;border-bottom:1px solid $border;padding-bottom:.25em}h3{font-size:1.25em}a{color:#8b6fd6}blockquote{margin:1em 0;padding:.5em 1em;border-left:4px solid #8b6fd6;color:$secondary;background:$code}pre{overflow:auto;padding:14px;border-radius:10px;background:$code}code{font-family:ui-monospace,monospace;background:$code;padding:.12em .3em;border-radius:4px}pre code{padding:0}table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}th,td{border:1px solid $border;padding:7px 10px}img{max-width:100%;height:auto;border-radius:8px}hr{border:0;border-top:1px solid $border}.frontmatter{padding:10px 14px;border:1px solid $border;border-radius:8px;color:$secondary}.frontmatter pre{white-space:pre-wrap;background:transparent;padding:8px 0;margin:0}.callout{border-radius:8px;border-left-width:5px}.callout.warning,.callout.caution{border-color:#f59e0b}.callout.danger,.callout.failure{border-color:#ef4444}.callout.success,.callout.tip{border-color:#22c55e}.block-id{display:block;position:relative;top:-12px;visibility:hidden}input[type=checkbox]{transform:scale(1.15);margin-right:.5em}
</style></head><body>$body</body></html>"""
    }

    private fun vaultImageUrl(path: String) = "https://vault.local/image?path=${encode(path)}"
    private fun encode(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8.toString())
    private fun escapeHtml(value: String) = value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    private fun escapeAttribute(value: String) = escapeHtml(value).replace("\"", "&quot;")
    private fun isLocalMarkdownDestination(value: String): Boolean {
        val path = value.substringBefore('#').substringBefore(' ')
        if ("://" in path || path.startsWith("mailto:") || path.startsWith("tel:")) return false
        return path.endsWith(".md", ignoreCase = true) || '#' in value
    }

    private fun resolveRelativeNotePath(currentPath: String, target: String): String {
        if (target.startsWith('/')) return target.trimStart('/')
        val segments = currentPath.substringBeforeLast('/', "")
            .split('/').filter(String::isNotEmpty).toMutableList()
        target.replace('\\', '/').split('/').forEach { segment ->
            when (segment) {
                "", "." -> Unit
                ".." -> if (segments.isNotEmpty()) segments.removeAt(segments.lastIndex)
                else -> segments += segment
            }
        }
        return segments.joinToString("/")
    }

    private val OBSIDIAN_EMBED = Regex("!\\[\\[([^]]+)]]")
    private val WIKI_LINK = Regex("(?<!!)\\[\\[([^]]+)]]")
    private val HTML_LINK = Regex("<a([^>]*?) href=\"([^\"]+)\"")
    private val HTML_IMAGE = Regex("<img([^>]*?) src=\"([^\"]+)\"")
    private val HEADING = Regex("<h([1-6])>(.*?)</h\\1>", setOf(RegexOption.DOT_MATCHES_ALL))
    private val HTML_TAG = Regex("<[^>]+>")
    private val CALLOUT = Regex("<blockquote>\\s*<p>\\[!(\\w+)]\\s*([^<]*)</p>(.*?)</blockquote>", setOf(RegexOption.DOT_MATCHES_ALL, RegexOption.IGNORE_CASE))
    private val BLOCK_ID = Regex("\\^([A-Za-z0-9-]+)(?=</p>|</li>)")
}
