package com.morgan.obsidianviewer

import org.junit.Test
import kotlin.test.assertEquals

class DataviewRendererTest {
    @Test
    fun numericValuesSortByNumberInsteadOfText() {
        val weeks = listOf("10", "11", "12", "13", "15", "2", "3", "4", "5", "6", "7", "8")

        assertEquals(
            listOf("2", "3", "4", "5", "6", "7", "8", "10", "11", "12", "13", "15"),
            weeks.sortedWith(::compareDataviewValues),
        )
    }

    @Test
    fun textValuesRemainCaseInsensitive() {
        assertEquals(listOf("Alpha", "beta", "Gamma"), listOf("Gamma", "beta", "Alpha").sortedWith(::compareDataviewValues))
    }

    @Test
    fun numberSortExpressionUsesItsInnerField() {
        assertEquals("week", dataviewSortKey("number(week)"))
        assertEquals("Week", dataviewSortKey("NUMBER( Week )"))
    }
}
