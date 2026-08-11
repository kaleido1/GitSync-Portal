package com.morgan.obsidianviewer

import kotlin.test.assertEquals
import org.junit.Test

class GitHubSyncTest {
    @Test
    fun manifestRemovesDeletedFilesAndTracksNewFiles() {
        assertEquals(
            setOf("kept.md", "folder/new.md"),
            reconcileTrackedPaths(
                previous = setOf("kept.md", "folder/deleted.md"),
                removed = setOf("folder/deleted.md"),
                added = setOf("folder/new.md"),
            ),
        )
    }

    @Test
    fun localOnlyFilesAreNeverAddedToOrRemovedFromManifest() {
        val tracked = reconcileTrackedPaths(
            previous = setOf("github.md"),
            removed = emptySet(),
            added = emptySet(),
        )

        assertEquals(setOf("github.md"), tracked)
    }
}
