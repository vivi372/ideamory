package com.ideamory.app;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private String pendingShareJson = null;
    private boolean pageLoaded = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() != null) {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new OrientationBridge(), "AndroidOrientationBridge");
            }
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public void onPageLoaded(WebView webView) {
                    pageLoaded = true;
                    flushPendingShareToWebView();
                }

                @Override
                public void onPageStarted(WebView webView) {
                    pageLoaded = false;
                }
            });
        }
        handleShareIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShareIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        flushPendingShareToWebView();
    }

    private void handleShareIntent(Intent intent) {
        if (intent == null) {
            return;
        }
        String action = intent.getAction();
        String type = intent.getType();
        if (!Intent.ACTION_SEND.equals(action) || !"text/plain".equals(type)) {
            return;
        }

        String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
        String sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if ((sharedText == null || sharedText.trim().isEmpty())
                && (sharedSubject == null || sharedSubject.trim().isEmpty())) {
            return;
        }

        try {
            JSONObject payload = new JSONObject();
            if (sharedText != null && !sharedText.trim().isEmpty()) {
                payload.put("text", sharedText.trim());
            }
            if (sharedSubject != null && !sharedSubject.trim().isEmpty()) {
                payload.put("title", sharedSubject.trim());
            }
            pendingShareJson = payload.toString();
            flushPendingShareToWebView();
        } catch (Exception ignored) {
            // JSON 직렬화 실패 시 무시
        }
    }

    private void flushPendingShareToWebView() {
        if (!pageLoaded || pendingShareJson == null || getBridge() == null) {
            return;
        }
        WebView webView = getBridge().getWebView();
        if (webView == null) {
            return;
        }
        final String payloadJson = pendingShareJson;
        final String script =
                "window.__IDEAMORY_PENDING_SHARE__=" + payloadJson + ";"
                        + "window.dispatchEvent(new CustomEvent('android:share_target',{detail:"
                        + payloadJson + "}));";
        pendingShareJson = null;
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private class OrientationBridge {
        @JavascriptInterface
        public void setScreenOrientationAuto() {
            runOnUiThread(() -> setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR));
        }

        @JavascriptInterface
        public void setScreenOrientationPortrait() {
            runOnUiThread(() -> setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
        }
    }
}
