package com.example

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color as AndroidColor
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.example.ui.theme.MyApplicationTheme

private const val GAME_ASSET_URL = "file:///android_asset/rel-kilat-lengkap_ab50420c.html"
private const val NIGHT_BG_HEX = 0xFF150F2E.toInt()

private class AndroidHostBridge(
  private val activity: ComponentActivity?,
  private val appContext: Context,
) {
  private fun resolveVibrator(): Vibrator? {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val manager = appContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
      manager?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      appContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
  }

  @JavascriptInterface
  fun exitApp() {
    activity?.runOnUiThread { activity.finish() }
  }

  @JavascriptInterface
  fun vibrate(durationMs: Int) {
    vibratePattern(durationMs.coerceIn(5, 400).toString())
  }

  @JavascriptInterface
  fun vibratePattern(csv: String) {
    val vibrator = resolveVibrator() ?: return
    if (!vibrator.hasVibrator()) return
    val parts = csv.split(",")
      .mapNotNull { it.trim().toLongOrNull()?.coerceIn(4L, 500L) }
    if (parts.isEmpty()) return

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        if (parts.size == 1) {
          vibrator.vibrate(
            VibrationEffect.createOneShot(parts[0], VibrationEffect.DEFAULT_AMPLITUDE),
          )
        } else {
          // Prepend 0ms initial delay so odd indices vibrate cleanly in alternating [wait, on, wait, on] order
          val timings = LongArray(parts.size + 1)
          timings[0] = 0L
          for (i in parts.indices) {
            timings[i + 1] = parts[i]
          }
          vibrator.vibrate(VibrationEffect.createWaveform(timings, -1))
        }
      } else {
        @Suppress("DEPRECATION")
        if (parts.size == 1) {
          vibrator.vibrate(parts[0])
        } else {
          val timings = LongArray(parts.size + 1)
          timings[0] = 0L
          for (i in parts.indices) {
            timings[i + 1] = parts[i]
          }
          vibrator.vibrate(timings, -1)
        }
      }
    } catch (_: SecurityException) {
    }
  }
}

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge(
      statusBarStyle = SystemBarStyle.dark(AndroidColor.TRANSPARENT),
      navigationBarStyle = SystemBarStyle.dark(AndroidColor.TRANSPARENT),
    )
    setContent {
      MyApplicationTheme {
        RelKilatScreen()
      }
    }
  }
}

@SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
@Composable
fun RelKilatScreen(modifier: Modifier = Modifier) {
  val context = LocalContext.current
  val lifecycleOwner = LocalLifecycleOwner.current

  val webView = remember {
    WebView(context).apply {
      layoutParams = ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      )
      setBackgroundColor(NIGHT_BG_HEX)
      overScrollMode = View.OVER_SCROLL_NEVER
      isVerticalScrollBarEnabled = false
      isHorizontalScrollBarEnabled = false
      isFocusable = true
      isFocusableInTouchMode = true
      requestFocus()

      settings.apply {
        javaScriptEnabled = true
        domStorageEnabled = true
        allowFileAccess = true
        mediaPlaybackRequiresUserGesture = false
        setSupportZoom(false)
        builtInZoomControls = false
        displayZoomControls = false
        cacheMode = WebSettings.LOAD_DEFAULT
      }

      addJavascriptInterface(
        AndroidHostBridge(context as? ComponentActivity, context.applicationContext),
        "AndroidHost",
      )
      webViewClient = WebViewClient()
      webChromeClient = WebChromeClient()
      loadUrl(GAME_ASSET_URL)
    }
  }

  DisposableEffect(lifecycleOwner, webView) {
    val observer = LifecycleEventObserver { _, event ->
      when (event) {
        Lifecycle.Event.ON_RESUME -> webView.onResume()
        Lifecycle.Event.ON_PAUSE -> webView.onPause()
        else -> Unit
      }
    }
    lifecycleOwner.lifecycle.addObserver(observer)
    onDispose {
      lifecycleOwner.lifecycle.removeObserver(observer)
      webView.destroy()
    }
  }

  Box(
    modifier = modifier
      .fillMaxSize()
      .background(Color(0xFF150F2E))
      .systemBarsPadding(),
  ) {
    AndroidView(
      factory = { webView },
      modifier = Modifier.fillMaxSize(),
    )
  }
}

