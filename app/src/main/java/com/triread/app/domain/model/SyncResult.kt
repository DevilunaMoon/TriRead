package com.triread.app.domain.model

data class SyncResult(
    val insertedCount: Int,
    val updatedCount: Int,
    val prunedCount: Int,
    val totalScanned: Int
)

