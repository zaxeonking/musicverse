package __APP_ID__;

import androidx.core.content.FileProvider;

/** FileProvider khusus berkas pembaruan APK (tidak bentrok dengan FileProvider bawaan Capacitor). */
public class UpdateFileProvider extends FileProvider {}
