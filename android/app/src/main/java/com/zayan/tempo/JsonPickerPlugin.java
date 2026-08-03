package com.zayan.tempo;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * Opens the system document picker and reads the chosen file's bytes
 * directly on the native side. The WebView <input type="file"> path can
 * hand JavaScript an empty File object on some Android builds, which made
 * imports fail with "the file is empty" even for valid backups.
 */
public class JsonPickerPlugin extends Plugin {

  private PluginCall pendingCall;
  private ActivityResultLauncher<Intent> launcher;

  @PluginMethod
  public void pick(PluginCall call) {
    if (pendingCall != null) {
      call.reject("picker already open", "PICK_BUSY");
      return;
    }
    Activity activity = getActivity();
    if (activity == null) {
      call.reject("activity unavailable", "PICK_UNAVAILABLE");
      return;
    }
    if (launcher == null) {
      launcher =
          ((ComponentActivity) activity)
              .registerForActivityResult(
                  new ActivityResultContracts.StartActivityForResult(), this::onPickResult);
    }
    pendingCall = call;

    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("*/*");
    intent.putExtra(
        Intent.EXTRA_MIME_TYPES,
        new String[] {"application/json", "text/plain", "application/octet-stream"});
    launcher.launch(intent);
  }

  private void onPickResult(ActivityResult result) {
    PluginCall call = pendingCall;
    pendingCall = null;
    if (call == null) return;

    if (result.getResultCode() != Activity.RESULT_OK
        || result.getData() == null
        || result.getData().getData() == null) {
      call.reject("cancelled", "PICK_CANCELLED");
      return;
    }

    Uri uri = result.getData().getData();
    try {
      String text = readText(uri);
      JSObject ret = new JSObject();
      ret.put("name", queryDisplayName(uri));
      ret.put("size", querySize(uri));
      ret.put("text", text);
      call.resolve(ret);
    } catch (Exception e) {
      call.reject("could not read file: " + e.getMessage(), "PICK_READ_FAILED");
    }
  }

  private String readText(Uri uri) throws Exception {
    StringBuilder sb = new StringBuilder();
    try (InputStream is = getContext().getContentResolver().openInputStream(uri);
        BufferedReader reader =
            new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
      char[] buf = new char[8192];
      int n;
      while ((n = reader.read(buf)) != -1) {
        sb.append(buf, 0, n);
      }
    }
    return sb.toString();
  }

  private String queryDisplayName(Uri uri) {
    try (Cursor cursor =
        getContext().getContentResolver().query(uri, null, null, null, null)) {
      if (cursor != null && cursor.moveToFirst()) {
        int idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
        if (idx >= 0) return cursor.getString(idx);
      }
    } catch (Exception ignored) {
      // fall through to the URI path
    }
    String path = uri.getLastPathSegment();
    return path != null ? path : "tempo-history.json";
  }

  private long querySize(Uri uri) {
    try (Cursor cursor =
        getContext().getContentResolver().query(uri, null, null, null, null)) {
      if (cursor != null && cursor.moveToFirst()) {
        int idx = cursor.getColumnIndex(OpenableColumns.SIZE);
        if (idx >= 0) return cursor.getLong(idx);
      }
    } catch (Exception ignored) {
      // size is best-effort
    }
    return 0;
  }
}
