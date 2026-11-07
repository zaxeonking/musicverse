package mv;
import java.io.IOException;
import java.util.*;
public class RadioTest {
  static int fails = 0;
  static void check(boolean ok, String msg){ if(!ok){fails++; System.out.println("FAIL: "+msg);} else System.out.println("ok: "+msg); }
  static RadioFinder.Candidate cand(String n, String title, String artist, String album, String dz){
    return new RadioFinder.Candidate(new RadioFinder.Track("dz-"+n,title,artist,album,200,"","u"), dz, album);
  }
  static class Fake implements RadioFinder.Source {
    boolean seedFails=false, genreFails=false, noArtistInSeed=false;
    int radioCalls=0;
    public RadioFinder.Seed findSeed(String t,String a) throws IOException { if(seedFails) throw new IOException("x"); return new RadioFinder.Seed(noArtistInSeed?null:"A1","S1","ALseed"); }
    public List<RadioFinder.Artist> searchArtists(String n){ return Arrays.asList(new RadioFinder.Artist("A9","Other",100), new RadioFinder.Artist("A2",n,50)); }
    public List<RadioFinder.Candidate> radio(String id,int limit){ radioCalls++; List<RadioFinder.Candidate> l=new ArrayList<>();
      l.add(cand("1","Same Song","Band","ALseed","T1")); // sama dgn seed -> dikecualikan
      for(int i=2;i<=40;i++) l.add(cand(""+i,"Song "+i,"Band"+(i%3),"AL"+(i%5),"T"+i)); return l; }
    public List<Integer> albumGenres(String al) throws IOException { if(genreFails) throw new IOException("g"); return Arrays.asList(al.equals("AL0")||al.equals("ALseed")?7:99); }
    public int tempo(String dz){ if(dz.equals("S1")) return 100; int n=Integer.parseInt(dz.substring(1)); return n%2==0?105:180; }
  }
  public static void main(String[] a) throws Exception {
    Fake f = new Fake();
    java.util.function.BooleanSupplier never = () -> false;
    List<RadioFinder.Track> out = RadioFinder.findSimilar(f,"Same Song","Band, Other",new HashSet<>(),never);
    check(out.size()==RadioFinder.BATCH, "batch size "+out.size());
    boolean hasSeed=false; for(RadioFinder.Track t: out) if(t.title.equals("Same Song")) hasSeed=true;
    check(!hasSeed, "seed excluded");
    Set<String> keys=new HashSet<>(); boolean dup=false; for(RadioFinder.Track t: out) if(!keys.add(RadioFinder.trackKey(t.title,t.artists))) dup=true;
    check(!dup,"no duplicates");
    // ranking: genre AL0 (cand i%5==0) +2, tempo even +1 for top; top results should be AL0 ones
    int genreFirst=0; for(int i=0;i<8;i++) if(out.get(i).album.equals("AL0")) genreFirst++;
    check(genreFirst==8, "8 genre-matching first (AL0 has 8 of 40): "+genreFirst);
    // among them, tempo-near (even) should be first: score 3 vs 2
    int evenFirst=0; for(int i=0;i<4;i++) if(Integer.parseInt(out.get(i).id.substring(3))%2==0) evenFirst++;
    check(evenFirst>=1, "tempo bonus ordering "+evenFirst);
    // exclude
    Set<String> ex=new HashSet<>(); ex.add(RadioFinder.trackKey("Song 5","Band2"));
    out = RadioFinder.findSimilar(f,"Same Song","Band",ex,never);
    boolean has5=false; for(RadioFinder.Track t: out) if(t.id.equals("dz-5")) has5=true;
    check(!has5,"exclude key honoured");
    // genre failure -> still results
    f.genreFails=true; out = RadioFinder.findSimilar(f,"Same Song","Band",new HashSet<>(),never);
    check(out.size()==RadioFinder.BATCH,"genre failure tolerated");
    // seed failure -> artist search path
    f.genreFails=false; f.seedFails=true; f.radioCalls=0; out = RadioFinder.findSimilar(f,"Same Song","Band",new HashSet<>(),never);
    check(out.size()==RadioFinder.BATCH && f.radioCalls==1,"seed failure falls back to artist search");
    // cancelled
    out = RadioFinder.findSimilar(f,"Same Song","Band",new HashSet<>(),() -> true);
    check(out.isEmpty(),"cancel -> empty");
    // empty artist
    out = RadioFinder.findSimilar(f,"X","",new HashSet<>(),never);
    check(out.isEmpty(),"empty artist -> empty");
    // pure key parity with TS trackKey: normalize(title)|normalize(first artist)
    check(RadioFinder.trackKey("Café  Déjà","Zoë, X").equals("cafe deja|zoe"),"trackKey parity");
    System.out.println(fails==0?"ALL OK":"FAILURES "+fails);
    System.exit(fails==0?0:1);
  }
}
