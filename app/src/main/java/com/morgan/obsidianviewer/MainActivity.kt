package com.morgan.obsidianviewer

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ObsidianViewerApp(applicationContext) }
    }
}

private data class ReaderPage(val note: VaultNote, val anchor: String? = null)

@Composable
private fun ObsidianViewerApp(context: Context) {
    val scope = rememberCoroutineScope()
    var vaultUri by remember { mutableStateOf(loadVaultUri(context)) }
    var index by remember { mutableStateOf(VaultIndex()) }
    var refreshToken by remember { mutableIntStateOf(0) }
    var isRefreshing by remember { mutableStateOf(false) }
    var folder by remember { mutableStateOf("") }
    var searchQuery by remember { mutableStateOf("") }
    var debouncedQuery by remember { mutableStateOf("") }
    var history by remember { mutableStateOf<List<ReaderPage>>(emptyList()) }
    var recentPaths by remember { mutableStateOf(loadRecentPaths(context)) }
    var githubToken by remember { mutableStateOf(TokenStore.load(context)) }
    var syncStatus by remember { mutableStateOf(loadSyncStatus(context)) }
    var isSyncing by remember { mutableStateOf(false) }

    LaunchedEffect(searchQuery) {
        delay(250)
        debouncedQuery = searchQuery
    }
    LaunchedEffect(vaultUri, refreshToken) {
        val uri = vaultUri
        if (uri == null) {
            index = VaultIndex()
            isRefreshing = false
        } else {
            isRefreshing = true
            index = withContext(Dispatchers.IO) { buildVaultIndex(context, uri) }
            isRefreshing = false
        }
    }

    fun rememberRecent(note: VaultNote) {
        recentPaths = (listOf(note.file.relativePath) + recentPaths).distinct().take(5)
        saveRecentPaths(context, recentPaths)
    }
    fun openNote(note: VaultNote, anchor: String? = null, replaceHistory: Boolean = false) {
        history = if (replaceHistory) listOf(ReaderPage(note, anchor)) else history + ReaderPage(note, anchor)
        rememberRecent(note)
    }
    fun navigateWiki(target: String, anchor: String?) {
        index.findNote(target)?.let { openNote(it, anchor) }
    }
    fun syncFromGitHub() {
        val uri = vaultUri
        if (uri == null) {
            syncStatus = "请先选择本地 Vault。"
            return
        }
        if (githubToken.isBlank()) {
            syncStatus = "请先输入 fine-grained token。"
            return
        }
        scope.launch {
            isSyncing = true
            syncStatus = "正在从 GitHub 下载私有 Vault…"
            runCatching {
                TokenStore.save(context, githubToken.trim())
                GitHubSynchronizer.sync(context, uri, githubToken.trim())
            }.onSuccess { result ->
                val time = result.syncedAt.atZone(ZoneId.systemDefault())
                    .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                syncStatus = "同步完成：${result.branch}，更新 ${result.copiedFiles} 个文件，$time"
                saveSyncStatus(context, syncStatus)
                refreshToken++
            }.onFailure { error ->
                syncStatus = error.message ?: "GitHub 同步失败。"
            }
            isSyncing = false
        }
    }

    val vaultPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            saveVaultUri(context, uri)
            vaultUri = uri
            folder = ""
            history = emptyList()
            refreshToken++
        }
    }

    val page = history.lastOrNull()
    BackHandler(enabled = page != null || folder.isNotEmpty()) {
        when {
            page != null -> history = history.dropLast(1)
            folder.isNotEmpty() -> folder = folder.substringBeforeLast('/', "")
        }
    }

    ObsidianViewerTheme {
        Surface(Modifier.fillMaxSize()) {
            if (page != null) {
                ReaderScreen(
                    page = page,
                    index = index,
                    context = context,
                    onBack = { history = history.dropLast(1) },
                    onWikiLink = ::navigateWiki,
                )
            } else {
                VaultBrowser(
                    vaultUri = vaultUri,
                    index = index,
                    folder = folder,
                    searchQuery = searchQuery,
                    debouncedQuery = debouncedQuery,
                    recentNotes = recentPaths.mapNotNull(index::findNote).take(3),
                    isRefreshing = isRefreshing,
                    githubToken = githubToken,
                    syncStatus = syncStatus,
                    isSyncing = isSyncing,
                    onPickVault = { vaultPicker.launch(vaultUri) },
                    onRefresh = { refreshToken++ },
                    onSearchChange = { searchQuery = it },
                    onGitHubTokenChange = { githubToken = it },
                    onGitHubSync = ::syncFromGitHub,
                    onFolderOpen = { name -> folder = if (folder.isEmpty()) name else "$folder/$name" },
                    onFolderUp = { folder = folder.substringBeforeLast('/', "") },
                    onNoteOpen = { openNote(it, replaceHistory = true) },
                )
            }
        }
    }
}

@Composable
private fun VaultBrowser(
    vaultUri: Uri?,
    index: VaultIndex,
    folder: String,
    searchQuery: String,
    debouncedQuery: String,
    recentNotes: List<VaultNote>,
    isRefreshing: Boolean,
    githubToken: String,
    syncStatus: String,
    isSyncing: Boolean,
    onPickVault: () -> Unit,
    onRefresh: () -> Unit,
    onSearchChange: (String) -> Unit,
    onGitHubTokenChange: (String) -> Unit,
    onGitHubSync: () -> Unit,
    onFolderOpen: (String) -> Unit,
    onFolderUp: () -> Unit,
    onNoteOpen: (VaultNote) -> Unit,
) {
    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = onRefresh,
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 12.dp),
        ) {
            Text("Obsidian Viewer", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Row(Modifier.padding(top = 10.dp)) {
                Button(onClick = onPickVault) { Text(if (vaultUri == null) "选择 Vault" else "更换 Vault") }
                Spacer(Modifier.width(10.dp))
                if (vaultUri != null) Button(onClick = onRefresh) { Text("刷新") }
            }
            if (vaultUri == null) {
                Text("请选择手机上的 Obsidian Vault。", Modifier.padding(top = 24.dp))
                return@Column
            }
            Text(
                "GitHub 私有仓库同步",
                modifier = Modifier.padding(top = 16.dp),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                "MorganTian886/Obsidian · 只读拉取",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = githubToken,
                onValueChange = onGitHubTokenChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                label = { Text("Fine-grained token") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
            )
            Button(
                onClick = onGitHubSync,
                enabled = !isSyncing,
                modifier = Modifier.padding(top = 8.dp),
            ) {
                Text(if (isSyncing) "正在同步…" else "从 GitHub 同步")
            }
            if (syncStatus.isNotBlank()) {
                Text(
                    syncStatus,
                    modifier = Modifier.padding(top = 6.dp),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            OutlinedTextField(
                value = searchQuery,
                onValueChange = onSearchChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 14.dp),
                label = { Text("搜索文件名和正文") },
                singleLine = true,
            )
            val searchResults = remember(index, debouncedQuery) { index.search(debouncedQuery) }
            LazyColumn(Modifier.fillMaxWidth()) {
                if (searchQuery.isBlank()) {
                    if (folder.isNotEmpty()) {
                        item {
                            BrowserRow("⬆  返回上一级", folder, onFolderUp)
                        }
                    } else if (recentNotes.isNotEmpty()) {
                        item {
                            Text(
                                "最近打开",
                                modifier = Modifier.padding(top = 18.dp, bottom = 6.dp),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        items(recentNotes, key = { "recent:${it.file.uri}" }) { note ->
                            BrowserRow("◷  ${note.file.name}", note.file.relativePath) { onNoteOpen(note) }
                        }
                        item { HorizontalDivider(Modifier.padding(vertical = 8.dp)) }
                    }
                    item {
                        Text(
                            if (folder.isEmpty()) "Vault 根目录" else folder,
                            modifier = Modifier.padding(top = 12.dp, bottom = 6.dp),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    items(index.foldersIn(folder), key = { "folder:$folder/$it" }) { name ->
                        BrowserRow("📁  $name", if (folder.isEmpty()) name else "$folder/$name") { onFolderOpen(name) }
                    }
                    items(index.notesIn(folder), key = { it.file.uri.toString() }) { note ->
                        BrowserRow("📄  ${note.file.name}", note.file.relativePath) { onNoteOpen(note) }
                    }
                } else {
                    item {
                        Text(
                            "搜索结果 (${searchResults.size})",
                            modifier = Modifier.padding(top = 16.dp, bottom = 6.dp),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    items(searchResults, key = { it.file.uri.toString() }) { note ->
                        BrowserRow("📄  ${note.file.name}", note.file.relativePath) { onNoteOpen(note) }
                    }
                }
            }
        }
    }
}

@Composable
private fun BrowserRow(title: String, subtitle: String, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 11.dp),
    ) {
        Text(title, style = MaterialTheme.typography.bodyLarge)
        Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    HorizontalDivider()
}

@Composable
private fun ReaderScreen(
    page: ReaderPage,
    index: VaultIndex,
    context: Context,
    onBack: () -> Unit,
    onWikiLink: (String, String?) -> Unit,
) {
    val dark = isSystemInDarkTheme()
    val rendered = remember(page, dark, index) {
        MarkdownRenderer.render(page.note, dark, index, page.anchor)
    }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .padding(top = 8.dp),
    ) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) {
            Button(onClick = onBack) { Text("返回") }
            Spacer(Modifier.width(12.dp))
            Column {
                Text(page.note.file.name.removeSuffix(".md"), fontWeight = FontWeight.SemiBold)
                Text(page.note.file.relativePath, style = MaterialTheme.typography.bodySmall)
            }
        }
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = {
                WebView(it).apply {
                    setBackgroundColor(android.graphics.Color.TRANSPARENT)
                    settings.javaScriptEnabled = false
                    settings.builtInZoomControls = false
                    settings.displayZoomControls = false
                    webViewClient = VaultWebViewClient(context, index, onWikiLink)
                    loadRenderedNoteIfChanged(rendered)
                }
            },
            update = { webView ->
                webView.webViewClient = VaultWebViewClient(context, index, onWikiLink)
                webView.loadRenderedNoteIfChanged(rendered)
            },
            onRelease = WebView::destroy,
        )
    }
}

private fun WebView.loadRenderedNoteIfChanged(rendered: RenderedNote) {
    val renderKey = 31 * rendered.html.hashCode() + rendered.anchor.hashCode()
    if (tag == renderKey) return
    tag = renderKey
    val base = "https://vault.local/note" + rendered.anchor?.let { "#$it" }.orEmpty()
    loadDataWithBaseURL(base, rendered.html, "text/html", "UTF-8", null)
}

private class VaultWebViewClient(
    private val context: Context,
    private val index: VaultIndex,
    private val onWikiLink: (String, String?) -> Unit,
) : WebViewClient() {
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val uri = request.url
        if (uri.scheme == "obsidian" && uri.host == "note") {
            onWikiLink(uri.getQueryParameter("path").orEmpty(), uri.getQueryParameter("heading"))
            return true
        }
        if (uri.scheme == "http" || uri.scheme == "https") {
            if (uri.host == "vault.local") return false
            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            return true
        }
        return true
    }

    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
        val uri = request.url
        if (uri.host != "vault.local" || uri.path != "/image") return null
        val asset = index.findAsset(uri.getQueryParameter("path").orEmpty()) ?: return null
        val stream = context.contentResolver.openInputStream(asset.uri) ?: return null
        return WebResourceResponse(asset.mimeType ?: "application/octet-stream", null, stream)
    }
}

@Composable
private fun ObsidianViewerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme(),
        content = content,
    )
}

private const val PREFERENCES_NAME = "obsidian_viewer"
private const val KEY_VAULT_URI = "vault_uri"
private const val KEY_RECENT_PATHS = "recent_paths"
private const val KEY_SYNC_STATUS = "sync_status"

private fun loadVaultUri(context: Context): Uri? = context
    .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    .getString(KEY_VAULT_URI, null)
    ?.let(Uri::parse)

private fun saveVaultUri(context: Context, uri: Uri) {
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit().putString(KEY_VAULT_URI, uri.toString()).apply()
}

private fun loadRecentPaths(context: Context): List<String> = context
    .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    .getString(KEY_RECENT_PATHS, "")
    .orEmpty().lineSequence().filter(String::isNotBlank).take(5).toList()

private fun saveRecentPaths(context: Context, paths: List<String>) {
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit().putString(KEY_RECENT_PATHS, paths.joinToString("\n")).apply()
}

private fun loadSyncStatus(context: Context): String = context
    .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    .getString(KEY_SYNC_STATUS, "")
    .orEmpty()

private fun saveSyncStatus(context: Context, status: String) {
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit().putString(KEY_SYNC_STATUS, status).apply()
}
