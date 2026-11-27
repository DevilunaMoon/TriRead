package com.triread.app.ui.update

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.triread.app.data.updater.AppUpdateInfo
import com.triread.app.data.updater.AppUpdateManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File

sealed interface UpdateUiState {
    data object Checking : UpdateUiState

    data class UpToDate(val info: AppUpdateInfo) : UpdateUiState

    data class Available(
        val info: AppUpdateInfo,
        val isDownloading: Boolean = false,
        val downloadProgress: Float = 0f,
        val downloadedApk: File? = null,
        val downloadError: String? = null
    ) : UpdateUiState

    data class Error(val message: String) : UpdateUiState
}

class UpdateViewModel(
    private val updateManager: AppUpdateManager
) : ViewModel() {

    private val _uiState = MutableStateFlow<UpdateUiState>(UpdateUiState.Checking)
    val uiState: StateFlow<UpdateUiState> = _uiState.asStateFlow()

    init {
        checkForUpdates()
    }

    fun checkForUpdates() {
        viewModelScope.launch {
            _uiState.value = UpdateUiState.Checking
            updateManager.checkForUpdate().fold(
                onFailure = { error ->
                    _uiState.value = UpdateUiState.Error(
                        error.localizedMessage ?: "Unable to check for updates. Check your internet connection."
                    )
                },
                onSuccess = { info ->
                    _uiState.value = if (info.isUpdateAvailable) {
                        UpdateUiState.Available(info = info)
                    } else {
                        UpdateUiState.UpToDate(info = info)
                    }
                }
            )
        }
    }

    fun startUpdateDownload(onReadyToInstall: (File) -> Unit) {
        val current = _uiState.value
        val info = when (current) {
            is UpdateUiState.Available -> current.info
            is UpdateUiState.UpToDate -> current.info
            else -> return
        }

        if (current is UpdateUiState.Available && current.isDownloading) return

        viewModelScope.launch {
            _uiState.value = UpdateUiState.Available(
                info = info,
                isDownloading = true,
                downloadProgress = 0f,
                downloadError = null
            )

            updateManager.downloadApk(
                downloadUrl = info.apkDownloadUrl,
                onProgress = { progress ->
                    _uiState.update { state ->
                        if (state is UpdateUiState.Available) {
                            state.copy(downloadProgress = progress)
                        } else {
                            state
                        }
                    }
                }
            ).fold(
                onFailure = { error ->
                    _uiState.value = UpdateUiState.Available(
                        info = info,
                        isDownloading = false,
                        downloadError = error.localizedMessage ?: "Failed to download update."
                    )
                },
                onSuccess = { apkFile ->
                    _uiState.value = UpdateUiState.Available(
                        info = info,
                        isDownloading = false,
                        downloadProgress = 1f,
                        downloadedApk = apkFile
                    )
                    onReadyToInstall(apkFile)
                }
            )
        }
    }

    fun buildInstallIntent(apkFile: File) = updateManager.buildInstallIntent(apkFile)

    companion object {
        fun provideFactory(updateManager: AppUpdateManager): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    require(modelClass.isAssignableFrom(UpdateViewModel::class.java)) {
                        "Unknown ViewModel class: ${modelClass.name}"
                    }
                    return UpdateViewModel(updateManager) as T
                }
            }
    }
}
