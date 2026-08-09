package com.morgan.obsidianviewer

import android.content.Context
import android.net.Uri
import android.util.Base64
import androidx.documentfile.provider.DocumentFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLConnection
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.util.zip.ZipInputStream

data class GitHubSyncResult(
    val branch: String,
    val copiedFiles: Int,
    val syncedAt: Instant,
    val commitSha: String,
    val changed: Boolean,
)

data class GitHubSyncProgress(val stage: String, val filesWritten: Int = 0)

object GitHubSynchronizer {
    private const val OWNER = "MorganTian886"
    private const val REPOSITORY = "Obsidian"
    private const val API_VERSION = "2026-03-10"

    suspend fun sync(
        context: Context,
        vaultUri: Uri,
        token: String,
        previousCommitSha: String? = null,
        onProgress: (GitHubSyncProgress) -> Unit = {},
    ): GitHubSyncResult =
        withContext(Dispatchers.IO) {
            require(token.isNotBlank()) { "请先输入 GitHub token。" }
            val root = DocumentFile.fromTreeUri(context, vaultUri)
                ?: error("无法访问已选择的 Vault。")
            onProgress(GitHubSyncProgress("正在连接 GitHub…"))
            val metadata = request(
                "https://api.github.com/repos/$OWNER/$REPOSITORY",
                token,
            ).use { connection ->
                ensureSuccess(connection)
                connection.inputStream.bufferedReader().use { JSONObject(it.readText()) }
            }
            val branch = metadata.getString("default_branch")
            val encodedBranch = URLEncoder.encode(branch, StandardCharsets.UTF_8.toString())
            onProgress(GitHubSyncProgress("正在检查最新 commit…"))
            val commitSha = request(
                "https://api.github.com/repos/$OWNER/$REPOSITORY/commits/$encodedBranch",
                token,
            ).use { connection ->
                ensureSuccess(connection)
                connection.inputStream.bufferedReader().use { JSONObject(it.readText()).getString("sha") }
            }
            if (previousCommitSha != null && previousCommitSha.equals(commitSha, ignoreCase = true)) {
                return@withContext GitHubSyncResult(branch, 0, Instant.now(), commitSha, changed = false)
            }
            if (previousCommitSha != null && SHA.matches(previousCommitSha)) {
                val incremental = runCatching {
                    copyCommitChanges(context, root, token, previousCommitSha, commitSha, onProgress)
                }.getOrNull()
                if (incremental != null) {
                    return@withContext GitHubSyncResult(branch, incremental, Instant.now(), commitSha, changed = true)
                }
                onProgress(GitHubSyncProgress("增量比较不可用，正在完整下载…"))
            }
            onProgress(GitHubSyncProgress("正在下载 Vault 压缩包…"))
            val archive = request(
                "https://api.github.com/repos/$OWNER/$REPOSITORY/zipball/$encodedBranch",
                token,
            )
            archive.use { connection ->
                ensureSuccess(connection)
                val copied = copyArchiveIntoVault(context, root, connection.inputStream, onProgress)
                GitHubSyncResult(branch, copied, Instant.now(), commitSha, changed = true)
            }
        }

    private fun copyCommitChanges(
        context: Context,
        root: DocumentFile,
        token: String,
        previousCommitSha: String,
        commitSha: String,
        onProgress: (GitHubSyncProgress) -> Unit,
    ): Int {
        onProgress(GitHubSyncProgress("正在比较 commit 变更…"))
        val comparison = request(
            "https://api.github.com/repos/$OWNER/$REPOSITORY/compare/$previousCommitSha...$commitSha",
            token,
        ).use { connection ->
            ensureSuccess(connection)
            connection.inputStream.bufferedReader().use { JSONObject(it.readText()) }
        }
        val files = comparison.getJSONArray("files")
        // GitHub Compare API caps this list; fall back rather than silently miss files.
        if (files.length() >= 300) error("变更文件过多，需要完整同步。")
        var copied = 0
        for (index in 0 until files.length()) {
            val file = files.getJSONObject(index)
            if (file.optString("status") == "removed") continue
            val path = file.getString("filename")
            if (!isSafePath(path)) continue
            val blobSha = file.getString("sha")
            val blobUrl = "https://api.github.com/repos/$OWNER/$REPOSITORY/git/blobs/$blobSha"
            val blob = request(blobUrl, token).use { connection ->
                ensureSuccess(connection)
                connection.inputStream.bufferedReader().use { JSONObject(it.readText()) }
            }
            require(blob.optString("encoding") == "base64") { "GitHub blob 编码不受支持：$path" }
            val bytes = Base64.decode(blob.getString("content"), Base64.DEFAULT)
            writeFile(context, root, path, bytes)
            copied++
            onProgress(GitHubSyncProgress("正在增量写入 Vault…", copied))
        }
        return copied
    }

    private fun writeFile(context: Context, root: DocumentFile, path: String, bytes: ByteArray) {
        val parentPath = path.substringBeforeLast('/', "")
        val fileName = path.substringAfterLast('/')
        val parent = ensureDirectory(root, parentPath)
        val mime = URLConnection.guessContentTypeFromName(fileName) ?: "application/octet-stream"
        val target = parent.findFile(fileName) ?: parent.createFile(mime, fileName)
            ?: error("无法创建文件：$path")
        context.contentResolver.openOutputStream(target.uri, "wt")?.use { it.write(bytes) }
            ?: error("无法写入文件：$path")
    }

    private fun request(url: String, token: String): HttpURLConnection {
        var current = URL(url)
        repeat(6) {
            require(isTrustedGitHubHost(current.host)) { "GitHub 返回了不受信任的下载地址。" }
            val connection = (current.openConnection() as HttpURLConnection).apply {
                instanceFollowRedirects = false
                connectTimeout = 20_000
                readTimeout = 60_000
                requestMethod = "GET"
                setRequestProperty("Accept", "application/vnd.github+json")
                setRequestProperty("X-GitHub-Api-Version", API_VERSION)
                setRequestProperty("User-Agent", "Obsidian-Viewer-Android")
                if (current.host == "api.github.com") {
                    setRequestProperty("Authorization", "Bearer $token")
                }
            }
            val code = connection.responseCode
            if (code !in 300..399) return connection
            val location = connection.getHeaderField("Location") ?: error("GitHub 重定向缺少地址。")
            connection.disconnect()
            current = URL(current, location)
        }
        error("GitHub 下载重定向次数过多。")
    }

    private fun ensureSuccess(connection: HttpURLConnection) {
        if (connection.responseCode in 200..299) return
        val message = connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
        val detail = runCatching { JSONObject(message).optString("message") }.getOrDefault("")
        error(
            when (connection.responseCode) {
                401 -> "Token 无效或已经过期。"
                403 -> "Token 没有该私有仓库的 Contents 读取权限。"
                404 -> "找不到私有仓库，请检查 token 是否授权给该仓库。"
                else -> "GitHub 同步失败（HTTP ${connection.responseCode}）${detail.takeIf { it.isNotBlank() }?.let { "：$it" }.orEmpty()}"
            },
        )
    }

    private fun copyArchiveIntoVault(
        context: Context,
        root: DocumentFile,
        input: java.io.InputStream,
        onProgress: (GitHubSyncProgress) -> Unit,
    ): Int {
        var copied = 0
        ZipInputStream(BufferedInputStream(input)).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                val path = entry.name.substringAfter('/', "")
                if (path.isBlank() || !isSafePath(path)) continue
                if (entry.isDirectory) {
                    ensureDirectory(root, path.trimEnd('/'))
                } else {
                    val parentPath = path.substringBeforeLast('/', "")
                    val fileName = path.substringAfterLast('/')
                    val parent = ensureDirectory(root, parentPath)
                    val mime = URLConnection.guessContentTypeFromName(fileName) ?: "application/octet-stream"
                    val target = parent.findFile(fileName) ?: parent.createFile(mime, fileName)
                        ?: error("无法创建文件：$path")
                    context.contentResolver.openOutputStream(target.uri, "wt")?.use { output ->
                        zip.copyTo(output, DEFAULT_BUFFER_SIZE)
                    } ?: error("无法写入文件：$path")
                    copied++
                    onProgress(GitHubSyncProgress("正在写入 Vault…", copied))
                }
                zip.closeEntry()
            }
        }
        return copied
    }

    private fun ensureDirectory(root: DocumentFile, path: String): DocumentFile {
        var current = root
        if (path.isBlank()) return current
        path.split('/').forEach { segment ->
            current = current.findFile(segment)?.takeIf { it.isDirectory }
                ?: current.createDirectory(segment)
                ?: error("无法创建文件夹：$path")
        }
        return current
    }

    private fun isSafePath(path: String): Boolean = path
        .replace('\\', '/')
        .split('/')
        .all { it.isNotBlank() && it != "." && it != ".." }

    private fun isTrustedGitHubHost(host: String): Boolean =
        host == "api.github.com" || host == "codeload.github.com"

    private val SHA = Regex("[0-9a-fA-F]{40}")
}

private inline fun <T> HttpURLConnection.use(block: (HttpURLConnection) -> T): T =
    try {
        block(this)
    } finally {
        disconnect()
    }
