package org.libreoffice.android;

import org.libreoffice.kit.COKit;

import java.nio.ByteBuffer;

public final class Bootstrap {

    private Bootstrap() {
    }

    static {
        COKit.ensureLibrariesLoaded();
    }

    public static native boolean setup(String dataDir, String cacheDir, String apkFile);

    public static native int getpid();

    public static native void putenv(String string);

    public static native void redirect_stdio(boolean state);

    public static native void setCommandArgs(String args);

    public static native int system(String cmdline);

    public static native long address_of_direct_byte_buffer(ByteBuffer b);
}

