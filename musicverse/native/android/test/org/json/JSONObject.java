package org.json;
public class JSONObject {
 public JSONObject(){} public JSONObject(String s) throws JSONException {}
 public boolean has(String k){return false;} public boolean isNull(String k){return true;} public Object opt(String k){return null;}
 public String optString(String k,String d){return d;} public int optInt(String k,int d){return d;} public long optLong(String k,long d){return d;}
 public double optDouble(String k,double d){return d;} public JSONObject optJSONObject(String k){return null;} public JSONArray optJSONArray(String k){return null;}
}
