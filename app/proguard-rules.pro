# TriRead R8 / ProGuard Rules

# Keep Room entities and DAOs
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.paging.**

# Keep domain enums used by Room TypeConverters
-keepclassmembers enum com.triread.app.domain.model.DocumentCategory {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Kotlin Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-dontwarn kotlinx.coroutines.flow.**

# Coil
-dontwarn okio.**

# Collabora / LibreOfficeKit JNI wrappers & callbacks
-keep class org.libreoffice.** { *; }
-keepclassmembers class org.libreoffice.** { *; }

