package com.ideamory.app;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private String pendingShareJson = null;
    private boolean pageLoaded = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES);
        super.onCreate(savedInstanceState);
        applyDarkSystemBars();
        setupSystemBarInsets();
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
        applyDarkSystemBars();
        flushPendingShareToWebView();
    }

    private void applyDarkSystemBars() {
        Window window = getWindow();
        if (window == null) {
            return;
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        int bgColor = Color.parseColor("#121110");
        window.setStatusBarColor(bgColor);
        window.setNavigationBarColor(bgColor);
        window.getDecorView().setBackgroundColor(bgColor);

        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(bgColor);
        }

        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }
    }

    private void setupSystemBarInsets() {
        View contentView = findViewById(android.R.id.content);
        if (contentView == null) {
            return;
        }
        ViewCompat.setOnApplyWindowInsetsListener(contentView, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(contentView);
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
