package com.ericzhang.pokelearn;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * PokeLearn 离线版外壳。
 * 所有网页资源都打包在 assets/www 中，通过 shouldInterceptRequest 从本地返回，
 * 使用 https 虚拟域名，保证 localStorage / DOM Storage / 音频都能正常工作，
 * 且不依赖网络、不依赖 Chrome、不依赖任何第三方 SDK。
 */
public class MainActivity extends Activity {

  private static final String HOST = "appassets.androidplatform.net";
  private WebView web;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    web = new WebView(this);
    setContentView(web);

    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setAllowFileAccess(false);
    s.setAllowContentAccess(false);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setCacheMode(WebSettings.LOAD_NO_CACHE);
    s.setLoadWithOverviewMode(true);
    s.setUseWideViewPort(true);
    s.setSupportZoom(false);
    s.setBuiltInZoomControls(false);
    s.setTextZoom(100);

    web.setWebViewClient(new LocalClient());
    web.setWebChromeClient(new WebChromeClient());
    web.loadUrl("https://" + HOST + "/index.html");
  }

  @Override
  public void onBackPressed() {
    if (web != null && web.canGoBack()) web.goBack();
    else super.onBackPressed();
  }

  private class LocalClient extends WebViewClient {
    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
      return serve(request.getUrl());
    }

    // 老版本 WebView 回调
    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
      return serve(Uri.parse(url));
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
      return handleExternal(request.getUrl());
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
      return handleExternal(Uri.parse(url));
    }

    /** 离线资源留在 WebView；「打开云同步版去登录」这类外部链接交给系统浏览器。 */
    private boolean handleExternal(Uri u) {
      if (u == null) return true;
      if (HOST.equals(u.getHost())) return false;
      String scheme = u.getScheme();
      if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
        try {
          startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (Exception ignored) { }
      }
      return true;
    }
  }

  private WebResourceResponse serve(Uri uri) {
    if (uri == null || !HOST.equals(uri.getHost())) return null;
    String path = uri.getPath();
    if (path == null || path.length() == 0 || path.equals("/")) path = "index.html";
    if (path.startsWith("/")) path = path.substring(1);
    if (path.indexOf("..") >= 0) return null;

    Map<String, String> headers = new HashMap<String, String>();
    headers.put("Access-Control-Allow-Origin", "*");
    headers.put("Cache-Control", "no-cache");
    headers.put("Accept-Ranges", "none");

    try {
      InputStream in = getAssets().open("www/" + path);
      return new WebResourceResponse(mime(path), "UTF-8", 200, "OK", headers, in);
    } catch (IOException e) {
      return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers,
          new ByteArrayInputStream("Not found".getBytes()));
    }
  }

  private static String mime(String p) {
    String l = p.toLowerCase();
    if (l.endsWith(".html") || l.endsWith(".htm")) return "text/html";
    if (l.endsWith(".js") || l.endsWith(".mjs")) return "application/javascript";
    if (l.endsWith(".css")) return "text/css";
    if (l.endsWith(".json") || l.endsWith(".webmanifest")) return "application/json";
    if (l.endsWith(".png")) return "image/png";
    if (l.endsWith(".jpg") || l.endsWith(".jpeg")) return "image/jpeg";
    if (l.endsWith(".webp")) return "image/webp";
    if (l.endsWith(".gif")) return "image/gif";
    if (l.endsWith(".svg")) return "image/svg+xml";
    if (l.endsWith(".ico")) return "image/x-icon";
    if (l.endsWith(".m4a") || l.endsWith(".mp4")) return "audio/mp4";
    if (l.endsWith(".mp3")) return "audio/mpeg";
    if (l.endsWith(".wav")) return "audio/wav";
    if (l.endsWith(".woff2")) return "font/woff2";
    if (l.endsWith(".woff")) return "font/woff";
    if (l.endsWith(".ttf")) return "font/ttf";
    return "application/octet-stream";
  }
}
