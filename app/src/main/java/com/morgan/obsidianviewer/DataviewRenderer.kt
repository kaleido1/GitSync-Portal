package com.morgan.obsidianviewer

import android.net.Uri

object DataviewRenderer {
    fun expand(markdown: String, index: VaultIndex): String = BLOCK.replace(markdown) { match ->
        runCatching { execute(match.groupValues[1], index) }
            .getOrElse { "> [!warning] Dataview\n> ${it.message ?: "查询解析失败"}" }
    }

    private fun execute(source: String, index: VaultIndex): String {
        val lines = source.lines().map(String::trim).filter(String::isNotBlank)
        require(lines.isNotEmpty()) { "Dataview 查询为空" }
        val command = lines.first()
        val type = command.substringBefore(' ').uppercase()
        require(type in setOf("LIST", "TABLE", "TASK")) { "暂不支持 $type；请使用 LIST、TABLE 或 TASK" }
        val from = lines.firstOrNull { it.startsWith("FROM ", true) }?.substringAfter(' ')
        val where = lines.firstOrNull { it.startsWith("WHERE ", true) }?.substringAfter(' ')
        val sort = lines.firstOrNull { it.startsWith("SORT ", true) }?.substringAfter(' ')
        var rows = index.notes.map(::record).filter { matchesFrom(it, from) }.filter { matchesWhere(it, where) }
        rows = sortRows(rows, sort)
        return when (type) {
            "TABLE" -> renderTable(command.removePrefixIgnoreCase("TABLE").trim(), rows)
            "TASK" -> renderTasks(rows)
            else -> renderList(command.removePrefixIgnoreCase("LIST").trim(), rows)
        }
    }

    private data class Record(val note: VaultNote, val fields: Map<String, String>) {
        fun get(raw: String): String {
            val key = raw.trim().removeSurrounding("\"").lowercase()
            return when (key) {
                "file.name" -> note.file.name.removeSuffix(".md")
                "file.path" -> note.file.relativePath
                "file.folder" -> note.file.relativePath.substringBeforeLast('/', "")
                "file.link" -> "[[${note.file.relativePath}|${note.file.name.removeSuffix(".md")}]]"
                else -> fields[key].orEmpty()
            }
        }
    }

    private fun record(note: VaultNote): Record {
        val values = linkedMapOf<String, String>()
        val normalized = note.content.replace("\r\n", "\n")
        if (normalized.startsWith("---\n")) {
            normalized.substringAfter("---\n").substringBefore("\n---\n")
                .lines().forEach { line ->
                    val key = line.substringBefore(':', "").trim()
                    if (key.isNotEmpty() && !line.startsWith(' ')) values[key.lowercase()] = line.substringAfter(':').trim().trim('"', '\'')
                }
        }
        INLINE_FIELD.findAll(normalized).forEach { result ->
            values[result.groupValues[1].trim().lowercase()] = result.groupValues[2].trim()
        }
        return Record(note, values)
    }

    private fun matchesFrom(row: Record, from: String?): Boolean {
        if (from.isNullOrBlank()) return true
        val value = from.trim()
        if (value.startsWith('#')) return Regex("(^|\\s)${Regex.escape(value)}(?=\\s|$)", RegexOption.IGNORE_CASE).containsMatchIn(row.note.content)
        val folder = value.removeSurrounding("\"").trim('/')
        return row.note.file.relativePath.startsWith("$folder/", true) || row.note.file.relativePath.equals(folder, true)
    }

    private fun matchesWhere(row: Record, where: String?): Boolean {
        if (where.isNullOrBlank()) return true
        CONTAINS.matchEntire(where.trim())?.let {
            return row.get(it.groupValues[1]).contains(unquote(it.groupValues[2]), true)
        }
        val match = COMPARISON.matchEntire(where.trim()) ?: return false
        val actual = row.get(match.groupValues[1])
        val expected = unquote(match.groupValues[3])
        return when (match.groupValues[2]) {
            "=" , "==" -> actual.equals(expected, true)
            "!=" -> !actual.equals(expected, true)
            ">" -> actual.toDoubleOrNull()?.let { it > (expected.toDoubleOrNull() ?: return false) } ?: (actual > expected)
            "<" -> actual.toDoubleOrNull()?.let { it < (expected.toDoubleOrNull() ?: return false) } ?: (actual < expected)
            ">=" -> actual.toDoubleOrNull()?.let { it >= (expected.toDoubleOrNull() ?: return false) } ?: (actual >= expected)
            "<=" -> actual.toDoubleOrNull()?.let { it <= (expected.toDoubleOrNull() ?: return false) } ?: (actual <= expected)
            else -> false
        }
    }

    private fun sortRows(rows: List<Record>, sort: String?): List<Record> {
        if (sort.isNullOrBlank()) return rows
        val key = sort.substringBeforeLast(' ').takeIf { sort.endsWith(" ASC", true) || sort.endsWith(" DESC", true) } ?: sort
        val result = rows.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.get(key) })
        return if (sort.endsWith(" DESC", true)) result.reversed() else result
    }

    private fun renderList(expression: String, rows: List<Record>): String = rows.joinToString("\n") { row ->
        val value = expression.takeIf(String::isNotBlank)?.let(row::get).orEmpty()
        "- [[${row.note.file.relativePath}|${row.note.file.name.removeSuffix(".md")}]]${value.takeIf(String::isNotBlank)?.let { " — $it" }.orEmpty()}"
    }.ifBlank { "*Dataview：没有匹配结果*" }

    private fun renderTable(expression: String, rows: List<Record>): String {
        val columns = splitColumns(expression).ifEmpty { listOf("file.link") }
        val headings = listOf("File") + columns.map { columnLabel(it) }
        val header = "| " + headings.joinToString(" | ") + " |\n| " + headings.joinToString(" | ") { "---" } + " |"
        val body = rows.joinToString("\n") { row ->
            val values = listOf("[[${row.note.file.relativePath}|${row.note.file.name.removeSuffix(".md")}]]") + columns.map { row.get(columnExpression(it)) }
            "| " + values.joinToString(" | ") { it.replace("|", "\\|").replace("\n", " ") } + " |"
        }
        return if (rows.isEmpty()) "*Dataview：没有匹配结果*" else "$header\n$body"
    }

    private fun renderTasks(rows: List<Record>): String {
        val tasks = rows.flatMap { row ->
            TASK_LINE.findAll(row.note.content).map { "- [${it.groupValues[1]}] ${it.groupValues[2]} — [[${row.note.file.relativePath}|${row.note.file.name.removeSuffix(".md")}]]" }.toList()
        }
        return tasks.joinToString("\n").ifBlank { "*Dataview：没有匹配任务*" }
    }

    private fun splitColumns(value: String): List<String> = value.split(',').map(String::trim).filter(String::isNotBlank)
    private fun columnExpression(value: String) = value.split(Regex("\\s+AS\\s+", RegexOption.IGNORE_CASE)).first().trim()
    private fun columnLabel(value: String) = value.split(Regex("\\s+AS\\s+", RegexOption.IGNORE_CASE)).getOrNull(1)?.let(::unquote) ?: columnExpression(value)
    private fun unquote(value: String) = Uri.decode(value.trim().removeSurrounding("\"").removeSurrounding("'"))
    private fun String.removePrefixIgnoreCase(prefix: String) = if (startsWith(prefix, true)) substring(prefix.length) else this

    private val BLOCK = Regex("```dataview\\s*\\n(.*?)```", setOf(RegexOption.DOT_MATCHES_ALL, RegexOption.IGNORE_CASE))
    private val INLINE_FIELD = Regex("(?m)^([A-Za-z][^:\\n]{0,80})::\\s*(.+)$")
    private val CONTAINS = Regex("contains\\(([^,]+),\\s*(.+)\\)", RegexOption.IGNORE_CASE)
    private val COMPARISON = Regex("([\\w.-]+)\\s*(==|=|!=|>=|<=|>|<)\\s*(.+)")
    private val TASK_LINE = Regex("(?m)^\\s*[-*] \\[([ xX])](.+)$")
}
