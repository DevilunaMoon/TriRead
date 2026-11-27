package com.triread.app.ui.navigation

import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.triread.app.AppContainer
import com.triread.app.ui.dashboard.DashboardScreen
import com.triread.app.ui.dashboard.DashboardViewModel
import com.triread.app.ui.update.UpdateScreen
import com.triread.app.ui.update.UpdateViewModel
import com.triread.app.ui.viewer.ViewerScreen
import com.triread.app.ui.viewer.ViewerViewModel

object TriReadRoutes {
    const val DASHBOARD = "dashboard"
    const val UPDATE = "update"
    const val VIEWER_ARG_URI = "encodedUri"
    const val VIEWER_PATTERN = "viewer/{$VIEWER_ARG_URI}"

    fun viewerRoute(uriString: String): String = "viewer/${Uri.encode(uriString)}"
}

@Composable
fun TriReadNavGraph(
    container: AppContainer,
    initialDocumentUri: String? = null,
    onInitialDocumentConsumed: () -> Unit = {}
) {
    val navController = rememberNavController()
    var hasCheckedStartupUpdate by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(initialDocumentUri) {
        if (!initialDocumentUri.isNullOrBlank()) {
            navController.navigate(TriReadRoutes.viewerRoute(initialDocumentUri)) {
                launchSingleTop = true
            }
            onInitialDocumentConsumed()
        }
    }

    // Mihon-style silent startup check: if online and a newer GitHub Release exists,
    // automatically open the Update screen (skipping if launched directly into a document).
    LaunchedEffect(Unit) {
        if (!hasCheckedStartupUpdate && initialDocumentUri.isNullOrBlank()) {
            hasCheckedStartupUpdate = true
            container.appUpdateManager.checkForUpdate().onSuccess { info ->
                if (info.isUpdateAvailable &&
                    navController.currentDestination?.route == TriReadRoutes.DASHBOARD
                ) {
                    navController.navigate(TriReadRoutes.UPDATE) {
                        launchSingleTop = true
                    }
                }
            }
        }
    }

    NavHost(
        navController = navController,
        startDestination = TriReadRoutes.DASHBOARD
    ) {
        composable(TriReadRoutes.DASHBOARD) {
            val dashboardViewModel: DashboardViewModel = viewModel(
                factory = DashboardViewModel.provideFactory(container.documentRepository)
            )
            DashboardScreen(
                viewModel = dashboardViewModel,
                onOpenDocument = { uriString ->
                    navController.navigate(TriReadRoutes.viewerRoute(uriString))
                },
                onCheckForUpdates = {
                    navController.navigate(TriReadRoutes.UPDATE)
                }
            )
        }

        composable(TriReadRoutes.UPDATE) {
            val updateViewModel: UpdateViewModel = viewModel(
                factory = UpdateViewModel.provideFactory(container.appUpdateManager)
            )
            UpdateScreen(
                viewModel = updateViewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(
            route = TriReadRoutes.VIEWER_PATTERN,
            arguments = listOf(
                navArgument(TriReadRoutes.VIEWER_ARG_URI) { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val encodedUri = backStackEntry.arguments?.getString(TriReadRoutes.VIEWER_ARG_URI).orEmpty()
            val decodedUri = Uri.decode(encodedUri)
            val viewerViewModel: ViewerViewModel = viewModel(
                factory = ViewerViewModel.provideFactory(
                    uriString = decodedUri,
                    appContext = container.appContext,
                    repository = container.documentRepository,
                    tempFileManager = container.collaboraTempFileManager
                )
            )
            ViewerScreen(
                viewModel = viewerViewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}
