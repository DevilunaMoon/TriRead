package org.libreoffice.kit;

import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.content.res.AssetManager;
import android.util.Log;

import java.nio.ByteBuffer;

public final class COKit {

    private static final String LOGTAG = "COKit";
    private static boolean initializeDone = false;

    private COKit() {
    }

    private static native boolean initializeNative(
            String dataDir,
            String cacheDir,
            String apkFile,
            AssetManager mgr
    );

    public static native ByteBuffer getCOKitHandle();

    public static native void putenv(String string);

    public static native void redirectStdio(boolean state);

    public static synchronized void init(Activity activity) {
        if (initializeDone) {
            return;
        }
        NativeLibLoader.load();

        AssetManager mgr = activity.getResources().getAssets();
        ApplicationInfo applicationInfo = activity.getApplicationInfo();
        String dataDir = applicationInfo.dataDir;
        String cacheDir = activity.getApplication().getCacheDir().getAbsolutePath();
        String apkFile = activity.getApplication().getPackageResourcePath();

        Log.i(LOGTAG, "Initializing COKit, dataDir=" + dataDir);
        redirectStdio(true);

        if (!initializeNative(dataDir, cacheDir, apkFile, mgr)) {
            Log.e(LOGTAG, "COKit initializeNative failed!");
            return;
        }
        initializeDone = true;
    }

    public static void ensureLibrariesLoaded() {
        NativeLibLoader.load();
    }

    static {
        NativeLibLoader.load();
    }
}

final class NativeLibLoader {
    private static boolean done = false;

    static synchronized void load() {
        if (done) {
            return;
        }
        String[] libs = {
                "c++_shared",
                "freebl3",
                "nspr4",
                "plc4",
                "plds4",
                "nssutil3",
                "nss3",
                "nssckbi",
                "nssdbm3",
                "smime3",
                "softokn3",
                "sqlite3",
                "ssl3",
                "lo-native-code",
                "androidapp"
        };
        for (String lib : libs) {
            try {
                System.loadLibrary(lib);
            } catch (UnsatisfiedLinkError e) {
                Log.w("COKit", "Optional or already-loaded library skipped: " + lib + " -> " + e.getMessage());
            }
        }
        done = true;
    }
}

