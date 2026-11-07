# Tes Java lokal (tanpa Android)
Menguji logika murni `RadioFinder` dengan sumber Deezer palsu. `org/json` di sini hanya STUB agar bisa dikompilasi; jangan disalin ke aplikasi.
Folder ini tidak ikut disalin ke proyek Android (`setup-android.mjs` hanya menyalin `native/android/java`).

    T=$(mktemp -d); mkdir -p $T/mv
    for f in RadioFinder TrackMatch; do sed 's/__APP_ID__/mv/' native/android/java/$f.java > $T/mv/$f.java; done
    cp native/android/test/mv/RadioTest.java $T/mv/
    java --module jdk.compiler/com.sun.tools.javac.Main -d $T/out native/android/test/org/json/*.java $T/mv/*.java
    java -cp $T/out mv.RadioTest

Tes logika warna widget (`WidgetColors`, murni tanpa Android):

    T=$(mktemp -d); mkdir -p $T/mv
    sed 's/__APP_ID__/mv/' native/android/java/WidgetColors.java > $T/mv/WidgetColors.java
    cp native/android/test/mv/WidgetColorsTest.java $T/mv/
    javac -d $T/out $T/mv/*.java && java -cp $T/out mv.WidgetColorsTest
