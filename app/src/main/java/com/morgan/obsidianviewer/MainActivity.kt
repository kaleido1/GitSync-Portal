package com.morgan.obsidianviewer

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ObsidianViewerApp(applicationContext) }
    }
}

private data class ReaderPage(val note: VaultNote, val anchor: String? = null)
private enum class BrowserSection { FILES, FAVORITES, HISTORY }

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
    var showSettings by remember { mutableStateOf(false) }
    var autoSyncEnabled by remember { mutableStateOf(loadBoolean(context, KEY_AUTO_SYNC, true)) }
    var wifiOnly by remember { mutableStateOf(loadBoolean(context, KEY_WIFI_ONLY, true)) }
    var readerPreferences by remember { mutableStateOf(loadReaderPreferences(context)) }
    var homePagePath by remember { mutableStateOf(loadHomePagePath(context)) }
    var homePageAttempted by remember { mutableStateOf(false) }
    var favoritePaths by remember { mutableStateOf(loadFavoritePaths(context)) }
    var browserSection by remember { mutableStateOf(BrowserSection.FILES) }
    var syncProgress by remember { mutableStateOf<GitHubSyncProgress?>(null) }
    var syncError by remember { mutableStateOf<String?>(null) }
    var lastSyncTime by remember { mutableLongStateOf(loadLastSyncTime(context)) }

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
    LaunchedEffect(index, homePagePath) {
        if (!homePageAttempted && index.notes.isNotEmpty()) {
            homePageAttempted = true
            homePagePath?.let(index::findNote)?.let { note ->
                history = listOf(ReaderPage(note))
                recentPaths = (listOf(note.file.relativePath) + recentPaths).distinct().take(50)
                saveRecentPaths(context, recentPaths)
            }
        }
    }

    fun rememberRecent(note: VaultNote) {
        recentPaths = (listOf(note.file.relativePath) + recentPaths).distinct().take(50)
        saveRecentPaths(context, recentPaths)
    }
    fun openNote(note: VaultNote, anchor: String? = null, replaceHistory: Boolean = false) {
        history = if (replaceHistory) listOf(ReaderPage(note, anchor)) else history + ReaderPage(note, anchor)
        rememberRecent(note)
    }
    fun navigateWiki(target: String, anchor: String?) {
        val note = index.findNote(target)
        if (note == null) {
            Toast.makeText(context, "找不到笔记：$target", Toast.LENGTH_LONG).show()
        } else {
            openNote(note, anchor)
        }
    }
    fun syncFromGitHub(automatic: Boolean = false) {
        val uri = vaultUri
        if (uri == null) {
            syncStatus = "请先选择本地 Vault。"
            return
        }
        if (githubToken.isBlank()) {
            syncStatus = "请先输入 fine-grained token。"
            return
        }
        if (automatic && wifiOnly && !isOnWifi(context)) {
            syncStatus = "等待 Wi‑Fi 后自动同步。"
            return
        }
        if (isSyncing) return
        scope.launch {
            isSyncing = true
            syncError = null
            syncProgress = GitHubSyncProgress("准备同步…")
            syncStatus = "正在从 GitHub 下载私有 Vault…"
            runCatching {
                TokenStore.save(context, githubToken.trim())
                GitHubSynchronizer.sync(
                    context,
                    uri,
                    githubToken.trim(),
                    previousCommitSha = loadLastCommitSha(context),
                ) { syncProgress = it }
            }.onSuccess { result ->
                val time = result.syncedAt.atZone(ZoneId.systemDefault())
                    .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                syncStatus = if (result.changed) {
                    "同步完成：${result.branch}，更新 ${result.copiedFiles} 个文件，$time"
                } else {
                    "已是最新版本：${result.branch} · ${result.commitSha.take(7)}，$time"
                }
                saveSyncStatus(context, syncStatus)
                saveLastSyncTime(context, result.syncedAt.toEpochMilli())
                saveLastCommitSha(context, result.commitSha)
                lastSyncTime = result.syncedAt.toEpochMilli()
                syncProgress = GitHubSyncProgress(if (result.changed) "同步完成" else "已是最新", result.copiedFiles)
                if (result.changed) refreshToken++
            }.onFailure { error ->
                syncStatus = error.message ?: "GitHub 同步失败。"
                syncError = syncStatus
                syncProgress = null
            }
            isSyncing = false
        }
    }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, vaultUri, githubToken, autoSyncEnabled, wifiOnly) {
        val observer = LifecycleEventObserver { _, event ->
            if (
                event == Lifecycle.Event.ON_START &&
                vaultUri != null &&
                githubToken.isNotBlank() &&
                autoSyncEnabled
            ) {
                syncFromGitHub(automatic = true)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
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
    BackHandler(enabled = page != null || showSettings || folder.isNotEmpty()) {
        when {
            page != null -> history = history.dropLast(1)
            showSettings -> showSettings = false
            folder.isNotEmpty() -> folder = folder.substringBeforeLast('/', "")
        }
    }

    ObsidianViewerTheme(readerPreferences.theme) {
        Surface(Modifier.fillMaxSize()) {
            if (page != null) {
                ReaderScreen(
                    page = page,
                    index = index,
                    context = context,
                    preferences = readerPreferences,
                    isHomePage = page.note.file.relativePath == homePagePath,
                    isFavorite = page.note.file.relativePath in favoritePaths,
                    onBack = { history = history.dropLast(1) },
                    onToggleHomePage = {
                        homePagePath = if (page.note.file.relativePath == homePagePath) null else page.note.file.relativePath
                        saveHomePagePath(context, homePagePath)
                    },
                    onToggleFavorite = {
                        favoritePaths = if (page.note.file.relativePath in favoritePaths) {
                            favoritePaths - page.note.file.relativePath
                        } else {
                            listOf(page.note.file.relativePath) + favoritePaths
                        }
                        saveFavoritePaths(context, favoritePaths)
                    },
                    onOpenBrowser = { section ->
                        browserSection = section
                        history = emptyList()
                    },
                    onSync = { syncFromGitHub() },
                    isSyncing = isSyncing,
                    onWikiLink = ::navigateWiki,
                )
            } else if (showSettings) {
                SettingsScreen(
                    token = githubToken,
                    syncStatus = syncStatus,
                    isSyncing = isSyncing,
                    autoSyncEnabled = autoSyncEnabled,
                    wifiOnly = wifiOnly,
                    readerPreferences = readerPreferences,
                    onBack = { showSettings = false },
                    onTokenChange = { githubToken = it },
                    onAutoSyncChange = {
                        autoSyncEnabled = it
                        saveBoolean(context, KEY_AUTO_SYNC, it)
                    },
                    onWifiOnlyChange = {
                        wifiOnly = it
                        saveBoolean(context, KEY_WIFI_ONLY, it)
                    },
                    onReaderPreferencesChange = {
                        readerPreferences = it
                        saveReaderPreferences(context, it)
                    },
                    onSync = { syncFromGitHub() },
                    onForgetToken = {
                        TokenStore.clear(context)
                        githubToken = ""
                        syncStatus = "已从手机删除 GitHub token。"
                    },
                )
            } else {
                VaultBrowser(
                    vaultUri = vaultUri,
                    index = index,
                    folder = folder,
                    searchQuery = searchQuery,
                    debouncedQuery = debouncedQuery,
                    recentNotes = recentPaths.mapNotNull(index::findNote).take(3),
                    historyNotes = recentPaths.mapNotNull(index::findNote),
                    favoriteNotes = favoritePaths.mapNotNull(index::findNote),
                    section = browserSection,
                    isRefreshing = isRefreshing,
                    syncStatus = syncStatus,
                    syncProgress = syncProgress,
                    syncError = syncError,
                    lastSyncTime = lastSyncTime,
                    onPickVault = { vaultPicker.launch(vaultUri) },
                    onRefresh = { refreshToken++ },
                    onSearchChange = { searchQuery = it },
                    onOpenSettings = { showSettings = true },
                    onSectionChange = { browserSection = it },
                    onSync = { syncFromGitHub() },
                    onClearHistory = {
                        recentPaths = emptyList()
                        saveRecentPaths(context, emptyList())
                    },
                    onFolderOpen = { name -> folder = if (folder.isEmpty()) name else "$folder/$name" },
                    onFolderUp = { folder = folder.substringBeforeLast('/', "") },
                    onNoteOpen = { openNote(it, replaceHistory = true) },
                )
            }
        }
    }
}

@Composable
private fun SettingsScreen(
    token: String,
    syncStatus: String,
    isSyncing: Boolean,
    autoSyncEnabled: Boolean,
    wifiOnly: Boolean,
    readerPreferences: ReaderPreferences,
    onBack: () -> Unit,
    onTokenChange: (String) -> Unit,
    onAutoSyncChange: (Boolean) -> Unit,
    onWifiOnlyChange: (Boolean) -> Unit,
    onReaderPreferencesChange: (ReaderPreferences) -> Unit,
    onSync: () -> Unit,
    onForgetToken: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
    ) {
        Button(onClick = onBack) { Text("返回") }
        Text(
            "设置",
            modifier = Modifier.padding(top = 20.dp),
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
        )
        Text(
            "GitHub 私有仓库同步",
            modifier = Modifier.padding(top = 24.dp),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            "MorganTian886/Obsidian · 只读拉取",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        OutlinedTextField(
            value = token,
            onValueChange = onTokenChange,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 10.dp),
            label = { Text("Fine-grained token") },
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true,
        )
        SettingSwitch(
            title = "启动时自动同步",
            subtitle = "每次打开 App 时从 GitHub 拉取最新 Vault",
            checked = autoSyncEnabled,
            onCheckedChange = onAutoSyncChange,
        )
        SettingSwitch(
            title = "仅 Wi‑Fi 自动同步",
            subtitle = "手动同步仍可使用移动网络",
            checked = wifiOnly,
            onCheckedChange = onWifiOnlyChange,
        )
        Row(Modifier.padding(top = 16.dp)) {
            Button(onClick = onSync, enabled = !isSyncing && token.isNotBlank()) {
                Text(if (isSyncing) "正在同步…" else "立即同步")
            }
            Spacer(Modifier.width(10.dp))
            Button(onClick = onForgetToken, enabled = token.isNotBlank() && !isSyncing) {
                Text("删除 Token")
            }
        }
        if (syncStatus.isNotBlank()) {
            Text(syncStatus, Modifier.padding(top = 14.dp), style = MaterialTheme.typography.bodyMedium)
        }
        Text(
            "Token 使用 Android Keystore 加密，仅保存在这台手机上。",
            modifier = Modifier.padding(top = 20.dp),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            "阅读显示",
            modifier = Modifier.padding(top = 24.dp),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        ReaderSlider("字号：${readerPreferences.fontSize}", readerPreferences.fontSize.toFloat(), 14f..24f, 9) {
            onReaderPreferencesChange(readerPreferences.copy(fontSize = it.roundToInt()))
        }
        ReaderSlider("行距：${"%.1f".format(readerPreferences.lineHeight)}", readerPreferences.lineHeight, 1.2f..2.2f, 9) {
            onReaderPreferencesChange(readerPreferences.copy(lineHeight = (it * 10).roundToInt() / 10f))
        }
        ReaderSlider("页边距：${readerPreferences.horizontalPadding}", readerPreferences.horizontalPadding.toFloat(), 2f..32f, 14) {
            onReaderPreferencesChange(readerPreferences.copy(horizontalPadding = it.roundToInt()))
        }
        Text("主题", modifier = Modifier.padding(top = 10.dp))
        Row(Modifier.padding(top = 6.dp)) {
            ReaderTheme.entries.forEach { theme ->
                Button(
                    onClick = { onReaderPreferencesChange(readerPreferences.copy(theme = theme)) },
                    enabled = readerPreferences.theme != theme,
                    modifier = Modifier.padding(end = 6.dp),
                ) {
                    Text(when (theme) { ReaderTheme.SYSTEM -> "跟随"; ReaderTheme.LIGHT -> "浅色"; ReaderTheme.DARK -> "深色" })
                }
            }
        }
        SettingSwitch(
            title = "启用 Obsidian CSS snippets",
            subtitle = "读取 .obsidian/snippets 中的 CSS",
            checked = readerPreferences.snippetsEnabled,
            onCheckedChange = { onReaderPreferencesChange(readerPreferences.copy(snippetsEnabled = it)) },
        )
    }
}

@Composable
private fun ReaderSlider(
    label: String,
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    steps: Int,
    onChange: (Float) -> Unit,
) {
    Text(label, modifier = Modifier.padding(top = 12.dp), style = MaterialTheme.typography.bodyMedium)
    Slider(value = value, onValueChange = onChange, valueRange = range, steps = steps)
}

@Composable
private fun SettingSwitch(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 18.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Text(subtitle, style = MaterialTheme.typography.bodySmall)
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
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
    historyNotes: List<VaultNote>,
    favoriteNotes: List<VaultNote>,
    section: BrowserSection,
    isRefreshing: Boolean,
    syncStatus: String,
    syncProgress: GitHubSyncProgress?,
    syncError: String?,
    lastSyncTime: Long,
    onPickVault: () -> Unit,
    onRefresh: () -> Unit,
    onSearchChange: (String) -> Unit,
    onOpenSettings: () -> Unit,
    onSectionChange: (BrowserSection) -> Unit,
    onSync: () -> Unit,
    onClearHistory: () -> Unit,
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
                Spacer(Modifier.width(10.dp))
                Button(onClick = onOpenSettings) { Text("设置") }
            }
            if (vaultUri == null) {
                Text("请选择手机上的 Obsidian Vault。", Modifier.padding(top = 24.dp))
                return@Column
            }
            if (syncStatus.isNotBlank()) {
                Text(
                    syncStatus,
                    modifier = Modifier.padding(top = 12.dp),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            if (syncProgress != null && syncProgress.stage !in setOf("同步完成", "已是最新")) {
                LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 8.dp))
                Text(
                    syncProgress.stage + if (syncProgress.filesWritten > 0) " ${syncProgress.filesWritten} 个文件" else "",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            if (lastSyncTime > 0) {
                Text("最后同步：${formatSyncTime(lastSyncTime)}", style = MaterialTheme.typography.bodySmall)
            }
            if (syncError != null) {
                Button(onClick = onSync, modifier = Modifier.padding(top = 6.dp)) { Text("重试同步") }
            }
            Row(Modifier.padding(top = 12.dp)) {
                Button(onClick = { onSectionChange(BrowserSection.FILES) }, enabled = section != BrowserSection.FILES) { Text("文件") }
                Spacer(Modifier.width(6.dp))
                Button(onClick = { onSectionChange(BrowserSection.FAVORITES) }, enabled = section != BrowserSection.FAVORITES) { Text("收藏") }
                Spacer(Modifier.width(6.dp))
                Button(onClick = { onSectionChange(BrowserSection.HISTORY) }, enabled = section != BrowserSection.HISTORY) { Text("历史") }
                Spacer(Modifier.width(6.dp))
                Button(onClick = onSync) { Text("同步") }
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
                if (searchQuery.isBlank() && section == BrowserSection.FAVORITES) {
                    item { SectionTitle("收藏笔记 (${favoriteNotes.size})") }
                    if (favoriteNotes.isEmpty()) item { Text("还没有收藏笔记。", Modifier.padding(vertical = 18.dp)) }
                    items(favoriteNotes, key = { "favorite:${it.file.uri}" }) { note ->
                        BrowserRow("★  ${note.file.name}", note.file.relativePath) { onNoteOpen(note) }
                    }
                } else if (searchQuery.isBlank() && section == BrowserSection.HISTORY) {
                    item {
                        Row(Modifier.fillMaxWidth().padding(top = 14.dp)) {
                            Text("阅读历史 (${historyNotes.size})", Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            Button(onClick = onClearHistory, enabled = historyNotes.isNotEmpty()) { Text("清空") }
                        }
                    }
                    if (historyNotes.isEmpty()) item { Text("暂无阅读历史。", Modifier.padding(vertical = 18.dp)) }
                    items(historyNotes, key = { "history:${it.file.uri}" }) { note ->
                        BrowserRow("◷  ${note.file.name}", note.file.relativePath) { onNoteOpen(note) }
                    }
                } else if (searchQuery.isBlank()) {
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
private fun SectionTitle(text: String) {
    Text(text, modifier = Modifier.padding(top = 16.dp, bottom = 6.dp), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
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
    preferences: ReaderPreferences,
    isHomePage: Boolean,
    isFavorite: Boolean,
    onBack: () -> Unit,
    onToggleHomePage: () -> Unit,
    onToggleFavorite: () -> Unit,
    onOpenBrowser: (BrowserSection) -> Unit,
    onSync: () -> Unit,
    isSyncing: Boolean,
    onWikiLink: (String, String?) -> Unit,
) {
    var webView by remember { mutableStateOf<WebView?>(null) }
    var showFind by remember { mutableStateOf(false) }
    var findQuery by remember { mutableStateOf("") }
    var activeMatch by remember { mutableIntStateOf(0) }
    var matchCount by remember { mutableIntStateOf(0) }
    var showScrolledTitle by remember(page.note.file.relativePath) { mutableStateOf(false) }
    val systemDark = isSystemInDarkTheme()
    val dark = when (preferences.theme) {
        ReaderTheme.SYSTEM -> systemDark
        ReaderTheme.LIGHT -> false
        ReaderTheme.DARK -> true
    }
    val rendered = remember(page, dark, index, preferences) {
        MarkdownRenderer.render(page.note, dark, index, page.anchor, preferences)
    }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .padding(top = 8.dp),
    ) {
        if (!showScrolledTitle && !showFind) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                Spacer(Modifier.weight(1f))
                Button(onClick = { showScrolledTitle = true }) { Text("菜单") }
            }
        }
        if (showScrolledTitle || showFind) {
            Row(Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) {
                Button(onClick = onBack) { Text("返回") }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(page.note.file.name.removeSuffix(".md"), fontWeight = FontWeight.SemiBold)
                    Text(page.note.file.relativePath, style = MaterialTheme.typography.bodySmall)
                }
                Spacer(Modifier.width(8.dp))
                Button(onClick = {
                    showScrolledTitle = false
                    showFind = false
                    findQuery = ""
                    matchCount = 0
                    webView?.clearMatches()
                }) { Text("收起") }
            }
            Row(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                Button(onClick = onToggleFavorite) { Text(if (isFavorite) "取消收藏" else "收藏") }
                Spacer(Modifier.width(6.dp))
                Button(onClick = onToggleHomePage) { Text(if (isHomePage) "取消首页" else "设为首页") }
                Spacer(Modifier.width(6.dp))
                Button(onClick = {
                    showFind = !showFind
                    if (!showFind) {
                        findQuery = ""
                        matchCount = 0
                        webView?.clearMatches()
                    }
                }) { Text(if (showFind) "关闭查找" else "页内查找") }
            }
            if (isHomePage) {
                Row(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                    Button(onClick = { onOpenBrowser(BrowserSection.FILES) }) { Text("文件") }
                    Spacer(Modifier.width(6.dp))
                    Button(onClick = { onOpenBrowser(BrowserSection.FAVORITES) }) { Text("收藏夹") }
                    Spacer(Modifier.width(6.dp))
                    Button(onClick = { onOpenBrowser(BrowserSection.HISTORY) }) { Text("历史") }
                    Spacer(Modifier.width(6.dp))
                    Button(onClick = onSync, enabled = !isSyncing) { Text(if (isSyncing) "同步中" else "同步") }
                }
            }
            if (showFind) {
                Row(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                    OutlinedTextField(
                        value = findQuery,
                        onValueChange = {
                            findQuery = it
                            if (it.isBlank()) {
                                webView?.clearMatches()
                                matchCount = 0
                            } else webView?.findAllAsync(it)
                        },
                        modifier = Modifier.weight(1f),
                        label = { Text("在本页查找") },
                        singleLine = true,
                    )
                    Spacer(Modifier.width(6.dp))
                    Column {
                        Text(if (matchCount == 0) "0/0" else "${activeMatch + 1}/$matchCount")
                        Row {
                            Button(onClick = { webView?.findNext(false) }, enabled = matchCount > 0) { Text("上") }
                            Spacer(Modifier.width(4.dp))
                            Button(onClick = { webView?.findNext(true) }, enabled = matchCount > 0) { Text("下") }
                        }
                    }
                }
            }
        }
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = {
                WebView(it).apply {
                    webView = this
                    addJavascriptInterface(
                        NoteNavigationBridge { path, heading, label ->
                            onWikiLink(path.takeIf { index.findNote(it) != null } ?: label, heading)
                        },
                        "ObsidianViewer",
                    )
                    setFindListener { activeMatchOrdinal, numberOfMatches, isDoneCounting ->
                        if (isDoneCounting) {
                            activeMatch = activeMatchOrdinal.coerceAtLeast(0)
                            matchCount = numberOfMatches
                        }
                    }
                    setBackgroundColor(android.graphics.Color.TRANSPARENT)
                    settings.javaScriptEnabled = true
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false
                    settings.domStorageEnabled = true
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
            onRelease = {
                if (webView === it) webView = null
                it.destroy()
            },
        )
    }
}

class NoteNavigationBridge(
    private val onWikiLink: (String, String?, String) -> Unit,
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun openNote(path: String, heading: String, label: String) {
        mainHandler.post { onWikiLink(path, heading.ifBlank { null }, label) }
    }
}

private fun WebView.loadRenderedNoteIfChanged(rendered: RenderedNote) {
    val renderKey = 31 * rendered.html.hashCode() + rendered.anchor.hashCode()
    if (tag == renderKey) return
    tag = renderKey
    val base = "https://vault.local/note" + rendered.anchor?.let { "#${Uri.encode(it)}" }.orEmpty()
    loadDataWithBaseURL(base, rendered.html, "text/html", "UTF-8", null)
}

private class VaultWebViewClient(
    private val context: Context,
    private val index: VaultIndex,
    private val onWikiLink: (String, String?) -> Unit,
) : WebViewClient() {
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val uri = request.url
        if (uri.host == "vault.local" && uri.path == "/open") {
            onWikiLink(uri.getQueryParameter("path").orEmpty(), uri.getQueryParameter("heading"))
            return true
        }
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
        if (uri.host == "app.local" && (uri.path?.startsWith("/assets/") == true || uri.path?.startsWith("/app/") == true)) {
            val path = if (uri.path!!.startsWith("/assets/")) {
                "vendor/" + uri.path!!.removePrefix("/assets/")
            } else {
                "app/" + uri.path!!.removePrefix("/app/")
            }
            val mime = when {
                path.endsWith(".js") -> "application/javascript"
                path.endsWith(".css") -> "text/css"
                path.endsWith(".woff2") -> "font/woff2"
                path.endsWith(".woff") -> "font/woff"
                path.endsWith(".ttf") -> "font/ttf"
                else -> "application/octet-stream"
            }
            return runCatching {
                WebResourceResponse(mime, if (mime.startsWith("text/") || mime.contains("javascript")) "UTF-8" else null, context.assets.open(path))
            }.getOrNull()
        }
        if (uri.host != "vault.local" || uri.path != "/image") return null
        val asset = index.findAsset(uri.getQueryParameter("path").orEmpty()) ?: return null
        val stream = context.contentResolver.openInputStream(asset.uri) ?: return null
        return WebResourceResponse(asset.mimeType ?: "application/octet-stream", null, stream)
    }
}

@Composable
private fun ObsidianViewerTheme(theme: ReaderTheme, content: @Composable () -> Unit) {
    val systemDark = isSystemInDarkTheme()
    val dark = when (theme) {
        ReaderTheme.SYSTEM -> systemDark
        ReaderTheme.LIGHT -> false
        ReaderTheme.DARK -> true
    }
    MaterialTheme(
        colorScheme = if (dark) darkColorScheme() else lightColorScheme(),
        content = content,
    )
}

private const val PREFERENCES_NAME = "obsidian_viewer"
private const val KEY_VAULT_URI = "vault_uri"
private const val KEY_RECENT_PATHS = "recent_paths"
private const val KEY_SYNC_STATUS = "sync_status"
private const val KEY_AUTO_SYNC = "auto_sync"
private const val KEY_WIFI_ONLY = "wifi_only"
private const val KEY_LAST_SYNC_TIME = "last_sync_time"
private const val KEY_HOME_PAGE_PATH = "home_page_path"
private const val KEY_FAVORITE_PATHS = "favorite_paths"
private const val KEY_LAST_COMMIT_SHA = "last_commit_sha"

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
    .orEmpty().lineSequence().filter(String::isNotBlank).take(50).toList()

private fun saveRecentPaths(context: Context, paths: List<String>) {
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit().putString(KEY_RECENT_PATHS, paths.joinToString("\n")).apply()
}

private fun loadFavoritePaths(context: Context): List<String> = context
    .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    .getString(KEY_FAVORITE_PATHS, "")
    .orEmpty().lineSequence().filter(String::isNotBlank).toList()

private fun saveFavoritePaths(context: Context, paths: List<String>) {
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit().putString(KEY_FAVORITE_PATHS, paths.joinToString("\n")).apply()
}

private fun loadHomePagePath(context: Context): String? = context
    .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    .getString(KEY_HOME_PAGE_PATH, null)

private fun saveHomePagePath(context: Context, path: String?) {
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit().apply {
            if (path == null) remove(KEY_HOME_PAGE_PATH) else putString(KEY_HOME_PAGE_PATH, path)
        }.apply()
}

private fun loadSyncStatus(context: Context): String = context
    .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    .getString(KEY_SYNC_STATUS, "")
    .orEmpty()

private fun saveSyncStatus(context: Context, status: String) {
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit().putString(KEY_SYNC_STATUS, status).apply()
}

private fun loadBoolean(context: Context, key: String, defaultValue: Boolean): Boolean = context
    .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    .getBoolean(key, defaultValue)

private fun saveBoolean(context: Context, key: String, value: Boolean) {
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit().putBoolean(key, value).apply()
}

private fun loadLastSyncTime(context: Context): Long = context
    .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    .getLong(KEY_LAST_SYNC_TIME, 0L)

private fun saveLastSyncTime(context: Context, value: Long) {
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit().putLong(KEY_LAST_SYNC_TIME, value).apply()
}

private fun loadLastCommitSha(context: Context): String? = context
    .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    .getString(KEY_LAST_COMMIT_SHA, null)

private fun saveLastCommitSha(context: Context, value: String) {
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit().putString(KEY_LAST_COMMIT_SHA, value).apply()
}

private fun formatSyncTime(value: Long): String = java.time.Instant.ofEpochMilli(value)
    .atZone(ZoneId.systemDefault())
    .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))

private fun isOnWifi(context: Context): Boolean {
    val manager = context.getSystemService(ConnectivityManager::class.java)
    val network = manager.activeNetwork ?: return false
    val capabilities = manager.getNetworkCapabilities(network) ?: return false
    return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
}
