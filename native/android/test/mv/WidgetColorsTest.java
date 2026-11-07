package mv;
import java.util.Objects;
public class WidgetColorsTest {
  static void eq(Object a,Object b){ if(!Objects.equals(a,b)) throw new AssertionError(a+" != "+b); }
  public static void main(String[] x){
    eq(WidgetColors.parseHex("#1db954"),0xFF1DB954); eq(WidgetColors.parseHex("f00"),0xFFFF0000); eq(WidgetColors.parseHex("#80112233"),0xFF112233);
    eq(WidgetColors.parseHex("zzzzzz"),null); eq(WidgetColors.parseHex("#12345"),null); eq(WidgetColors.parseHex(null),null);
    eq(WidgetColors.toHex(0xFF1DB954),"#1DB954");
    eq(WidgetColors.onColor(0xFFFFFFFF),0xFF111111); eq(WidgetColors.onColor(0xFF181818),0xFFFFFFFF); eq(WidgetColors.onColor(0xFF1DB954),0xFF111111);
    float[] h0=WidgetColors.toHsv(0xFF2196F3); eq(WidgetColors.fromHsv(h0[0],h0[1],h0[2]),0xFF2196F3);
    int red=0xFFE02020; int[] px=new int[64]; java.util.Arrays.fill(px,red);
    int d=WidgetColors.dominant(px,0xFF1DB954); float h=WidgetColors.toHsv(d)[0]; if(h>5&&h<355) throw new AssertionError("hue "+h);
    java.util.Arrays.fill(px,0xFF808080); eq(WidgetColors.dominant(px,0xFF1DB954),0xFF1DB954);
    java.util.Arrays.fill(px,0x00FF0000); eq(WidgetColors.dominant(px,7),7);
    eq(WidgetColors.withAlpha(0xFFFFFFFF,0x80),0x80FFFFFF);
    System.out.println("deep "+WidgetColors.toHex(WidgetColors.deep(red))+" vivid "+WidgetColors.toHex(WidgetColors.vivid(0xFF303030)));
    System.out.println("OK");
  }
}
