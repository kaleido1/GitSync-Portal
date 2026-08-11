package com.morgan.obsidianviewer

import android.net.Uri
import org.commonmark.Extension
import org.commonmark.ext.autolink.AutolinkExtension
import org.commonmark.ext.gfm.strikethrough.StrikethroughExtension
import org.commonmark.ext.gfm.tables.TablesExtension
import org.commonmark.ext.task.list.items.TaskListItemsExtension
import org.commonmark.parser.Parser
import org.commonmark.renderer.html.HtmlRenderer

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
        // Navigation is allow-listed by VaultWebViewClient through the vault.local route.
        .sanitizeUrls(false)
        .build()

    fun render(
        note: VaultNote,
        dark: Boolean,
        index: VaultIndex,
        requestedAnchor: String? = null,
        preferences: ReaderPreferences = ReaderPreferences(),
    ): RenderedNote {
        val (frontmatter, markdownBody) = extractFrontmatter(note.content)
        val normalizedBody = normalizeObsidianEmphasis(markdownBody)
        val queried = DataviewRenderer.expand(normalizedBody, index)
        val expanded = expandEmbeds(queried, index, mutableSetOf(note.file.relativePath), 0)
        val linked = rewriteLinks(expanded, note, index)
        var body = renderer.render(parser.parse(linked))
        body = rewriteRenderedLinks(body, note)
        body = rewriteRenderedImages(body, index)
        body = addHeadingIds(body)
        body = addBlockIds(body)
        body = decorateCallouts(body)
        val frontmatterHtml = frontmatter?.let { renderFrontmatter(it, note, index) }.orEmpty()
        return RenderedNote(
            html = htmlDocument(frontmatterHtml + body, dark, preferences, index.snippetCss, note.file.relativePath),
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

    private fun normalizeObsidianEmphasis(markdown: String): String = STRONG_WITH_TRAILING_SPACE.replace(markdown) {
        "**${it.groupValues[1]}** "
    }

    private fun renderFrontmatter(frontmatter: String, note: VaultNote, index: VaultIndex): String {
        val content = buildString {
            var cursor = 0
            WIKI_LINK.findAll(frontmatter).forEach { match ->
                append(escapeHtml(frontmatter.substring(cursor, match.range.first)))
                val raw = match.groupValues[1]
                val target = raw.substringBefore('|').trim()
                val label = raw.substringAfter('|', target).trim()
                val asset = index.findAsset(target)
                val href = if (asset != null) {
                    "https://vault.local/asset?path=${encode(asset.relativePath)}"
                } else {
                    val heading = target.substringAfter('#', "")
                    val noteTarget = target.substringBefore('#').ifBlank { note.file.relativePath }
                    "https://vault.local/open?path=${encode(noteTarget)}" +
                        heading.takeIf(String::isNotEmpty)?.let { "&heading=${encode(it)}" }.orEmpty()
                }
                append("<a href=\"${escapeAttribute(href)}\">${escapeHtml(label)}</a>")
                cursor = match.range.last + 1
            }
            append(escapeHtml(frontmatter.substring(cursor)))
        }
        return "<details class=\"frontmatter\"><summary>Properties</summary><pre>$content</pre></details>"
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
            val uri = "https://vault.local/open?path=${encode(noteTarget)}" +
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
                "https://vault.local/open?path=${encode(note.file.relativePath)}&heading=${encode(heading)}"
            }
            isLocalMarkdownDestination(destination) -> {
                val rawPath = destination.substringBefore('#')
                val heading = destination.substringAfter('#', "").let(Uri::decode)
                val resolved = resolveRelativeNotePath(note.file.relativePath, Uri.decode(rawPath))
                "https://vault.local/open?path=${encode(resolved)}" +
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

    private fun decorateCallouts(html: String): String = BLOCKQUOTE.replace(html) { block ->
        val inner = block.groupValues[1]
        val marker = CALLOUT_MARKER.find(inner) ?: return@replace block.value
        val type = marker.groupValues[1].lowercase()
        val fold = marker.groupValues[2]
        val title = marker.groupValues[3].trim().ifBlank { type.replaceFirstChar(Char::uppercase) }
        val content = inner.replaceRange(marker.range, "<p>")
        if (fold.isNotEmpty()) {
            "<details class=\"callout $type\"${if (fold == "+") " open" else ""}>" +
                "<summary class=\"callout-title\">${escapeHtml(title)}</summary>$content</details>"
        } else {
            "<blockquote class=\"callout $type\"><div class=\"callout-title\">${escapeHtml(title)}</div>$content</blockquote>"
        }
    }

    private fun htmlDocument(
        body: String,
        dark: Boolean,
        preferences: ReaderPreferences,
        snippetCss: String,
        noteKey: String,
    ): String {
        val background = if (dark) "#121212" else "#fafafa"
        val foreground = if (dark) "#e6e1e5" else "#242424"
        val secondary = if (dark) "#cac4d0" else "#555"
        val border = if (dark) "#49454f" else "#ddd"
        val code = if (dark) "#242126" else "#f1eff3"
        val safeSnippets = if (preferences.snippetsEnabled) {
            snippetCss.replace("</style", "<\\/style", ignoreCase = true)
        } else ""
        val highlightTheme = if (dark) "github-dark-11.11.1.min.css" else "github-11.11.1.min.css"
        return """<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src https://app.local 'unsafe-inline'; font-src https://app.local; script-src https://app.local 'unsafe-inline'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'">
<link rel="stylesheet" href="https://app.local/assets/katex/katex-0.18.2.min.css">
<link rel="stylesheet" href="https://app.local/assets/highlight/$highlightTheme">
<link rel="stylesheet" href="https://app.local/app/quizzable.css">
<style>
:root{color-scheme:${if (dark) "dark" else "light"}}*{box-sizing:border-box}body{margin:0;padding:8px ${preferences.horizontalPadding}px 90px;background:$background;color:$foreground;font:${preferences.fontSize}px/${preferences.lineHeight} system-ui,sans-serif;overflow-wrap:anywhere}h1,h2,h3,h4,h5,h6{line-height:1.3;margin:1.25em 0 .5em;scroll-margin-top:12px}h1{font-size:2em}h2{font-size:1.55em;border-bottom:1px solid $border;padding-bottom:.25em}h3{font-size:1.25em}a{color:#8b6fd6}blockquote{margin:1em 0;padding:.5em 1em;border-left:4px solid #8b6fd6;color:$secondary;background:$code}pre{overflow:auto;padding:14px;border-radius:10px;background:$code}code{font-family:ui-monospace,monospace;background:$code;padding:.12em .3em;border-radius:4px}pre code{padding:0;background:transparent}table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}th,td{border:1px solid $border;padding:7px 10px}img{max-width:100%;height:auto;border-radius:8px}hr{border:0;border-top:1px solid $border}.frontmatter{padding:10px 14px;border:1px solid $border;border-radius:8px;color:$secondary}.frontmatter pre{white-space:pre-wrap;background:transparent;padding:8px 0;margin:0}.callout{display:block;margin:1em 0;padding:.65em 1em;border:1px solid $border;border-left:5px solid #8b6fd6;border-radius:8px;color:$secondary;background:$code}.callout-title{font-weight:750;color:$foreground;margin-bottom:.35em}.callout p:first-of-type{margin-top:.25em}.callout.important,.callout.note,.callout.notes,.callout.info{border-left-color:#8b6fd6}.callout.warning,.callout.caution{border-left-color:#f59e0b}.callout.danger,.callout.failure,.callout.bug{border-left-color:#ef4444}.callout.success,.callout.tip{border-left-color:#22c55e}.block-id{display:block;position:relative;top:-12px;visibility:hidden}input[type=checkbox]{transform:scale(1.15);margin-right:.5em}.mermaid{overflow:auto;text-align:center;margin:1.2em 0}#toc-toggle{position:fixed;right:18px;bottom:22px;z-index:20;border:0;border-radius:999px;padding:11px 15px;background:#8b6fd6;color:white;font-weight:700;box-shadow:0 4px 18px #0006}.render-error{padding:10px;border:1px solid #ef4444;border-radius:8px;color:#ef4444}
</style><style id="vault-snippets">$safeSnippets</style><style id="toc-layout">
#toc-panel{position:fixed!important;left:4vw!important;right:4vw!important;bottom:76px!important;z-index:19!important;width:auto!important;height:7cm!important;min-height:7cm!important;max-width:none!important;max-height:7cm!important;overflow-y:auto!important;padding:18px 14px!important;background:$background!important;border:1px solid $border!important;border-radius:18px!important;box-shadow:0 8px 30px #0009!important;display:none!important}#toc-panel.open{display:block!important}#toc-panel a{display:block!important;padding:12px 10px!important;min-height:48px!important;text-decoration:none!important;border-radius:9px!important;color:$foreground!important;font-size:1.05em!important;line-height:1.35!important}#toc-panel a.active{background:$code!important;color:#9c7de8!important}
</style></head><body>$body
<button id="toc-toggle" type="button" hidden>目录</button><nav id="toc-panel" aria-label="本页目录"></nav>
<script src="https://app.local/assets/highlight/highlight-11.11.1.min.js"></script>
<script src="https://app.local/assets/katex/katex-0.18.2.min.js"></script>
<script src="https://app.local/assets/katex/auto-render-0.18.2.min.js"></script>
<script src="https://app.local/assets/mermaid/mermaid-11.16.1.min.js"></script>
<script src="https://app.local/assets/js-yaml/js-yaml-4.1.0.min.js"></script>
<script src="https://app.local/app/quizzable.js"></script>
<script>
document.addEventListener('DOMContentLoaded',async()=>{
  const showError=(message)=>{const e=document.createElement('div');e.className='render-error';e.textContent=message;document.body.prepend(e)};
  document.querySelectorAll('a[href^="https://vault.local/open?"]').forEach(link=>{link.addEventListener('click',event=>{event.preventDefault();const url=new URL(link.href);ObsidianViewer.openNote(url.searchParams.get('path')||'',url.searchParams.get('heading')||'',link.textContent.trim())})});
  try{document.querySelectorAll('pre code.language-mermaid').forEach(code=>{const box=document.createElement('div');box.className='mermaid';box.textContent=code.textContent;code.parentElement.replaceWith(box)});mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'${if (dark) "dark" else "default"}'});await mermaid.run({querySelector:'.mermaid'});}catch(e){showError('Mermaid 渲染失败：'+e.message)}
  try{hljs.highlightAll()}catch(e){showError('代码高亮失败：'+e.message)}
  try{renderMathInElement(document.body,{delimiters:[{left:'${'$'}${'$'}',right:'${'$'}${'$'}',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false},{left:'${'$'}',right:'${'$'}',display:false}],throwOnError:false,ignoredClasses:['mermaid']})}catch(e){showError('公式渲染失败：'+e.message)}
  try{initQuizzable('${escapeJs(noteKey)}')}catch(e){showError('Quizzable 渲染失败：'+e.message)}
  const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];const panel=document.getElementById('toc-panel');const toggle=document.getElementById('toc-toggle');
  if(headings.length){toggle.hidden=false;headings.forEach((h,i)=>{if(!h.id)h.id='section-'+i;const a=document.createElement('a');a.textContent=h.textContent;a.href='#'+encodeURIComponent(h.id);a.style.paddingLeft=(8+(Number(h.tagName[1])-1)*12)+'px';a.onclick=e=>{e.preventDefault();h.scrollIntoView({behavior:'smooth'});history.replaceState(null,'','#'+encodeURIComponent(h.id));panel.classList.remove('open')};panel.appendChild(a)});toggle.onclick=()=>panel.classList.toggle('open');const links=[...panel.querySelectorAll('a')];new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){links.forEach(a=>a.classList.toggle('active',decodeURIComponent(a.hash.slice(1))===entry.target.id))}}),{rootMargin:'-10% 0px -75% 0px'}).observe(headings[0]);headings.slice(1).forEach(h=>new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){links.forEach(a=>a.classList.toggle('active',decodeURIComponent(a.hash.slice(1))===entry.target.id))}}),{rootMargin:'-10% 0px -75% 0px'}).observe(h));}
});
</script></body></html>"""
    }

    private fun vaultImageUrl(path: String) = "https://vault.local/image?path=${encode(path)}"
    private fun encode(value: String): String = Uri.encode(value)
    private fun escapeHtml(value: String) = value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    private fun escapeAttribute(value: String) = escapeHtml(value).replace("\"", "&quot;")
    private fun escapeJs(value: String) = value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
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
    private val BLOCKQUOTE = Regex("<blockquote>\\s*(.*?)\\s*</blockquote>", setOf(RegexOption.DOT_MATCHES_ALL, RegexOption.IGNORE_CASE))
    private val CALLOUT_MARKER = Regex("^\\s*<p>\\[!([A-Za-z0-9_-]+)]([+-]?)[ \\t]*([^\\r\\n<]*)\\r?\\n?", RegexOption.IGNORE_CASE)
    private val BLOCK_ID = Regex("\\^([A-Za-z0-9-]+)(?=</p>|</li>)")
    private val STRONG_WITH_TRAILING_SPACE = Regex("\\*\\*([^*\\n]*?\\S)\\s+\\*\\*")
}
