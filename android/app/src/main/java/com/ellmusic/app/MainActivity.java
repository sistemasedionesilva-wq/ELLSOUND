package com.ellmusic.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.media.AudioManager;
import android.content.Context;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.Bridge;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Configurar AudioManager para manter áudio em background
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        
        // Configurar WebView para permitir reprodução em background
        if (getBridge() != null && getBridge().getWebView() != null) {
            configureWebView(getBridge().getWebView());
        }
    }

    @Override
    public void onBridgeCreated(Bridge bridge) {
        super.onBridgeCreated(bridge);
        
        if (bridge.getWebView() != null) {
            configureWebView(bridge.getWebView());
        }
    }

    private void configureWebView(WebView webView) {
        WebSettings settings = webView.getSettings();
        
        // Permitir reprodução de mídia em background
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        
        // Configurações de mídia
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        }
        
        // Permitir reprodução inline e picture-in-picture
        settings.setMediaPlaybackRequiresUserGesture(false);
    }

    @Override
    protected void onPause() {
        super.onPause();
        // NÃO pausar o WebView - permite áudio em background
    }

    @Override
    protected void onResume() {
        super.onResume();
    }
}
