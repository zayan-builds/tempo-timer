package com.zayan.tempo;

import android.Manifest;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Saves a UTF-8 text file directly to the user's public Downloads folder.
 *
 * API 29+ uses MediaStore.Downloads (scoped storage, no permission required).
 * API 24-28 falls back to the legacy public Downloads path behind a
 * WRITE_EXTERNAL_STORAGE runtime request (maxSdkVersion 28 in the manifest).
 */
@CapacitorPlugin(
    name = "Downloads",
    permissions = {
      @Permission(
          strings = {Manifest.permission.WRITE_EXTERNAL_STORAGE},
          alias = "storage")
    })
public class DownloadsPlugin extends Plugin {

  private static final String MIME_JSON = "application/json";

  @PluginMethod
  public void save(PluginCall call) {
    String fileName = call.getString("fileName");
    String data = call.getString("data");
    if (fileName == null || fileName.isEmpty()) {
      call.reject("fileName is required");
      return;
    }
    if (data == null) {
      call.reject("data is required");
      return;
    }

    // Scoped storage (API 29+) never needs this permission; legacy path does.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
        && getPermissionState("storage") != PermissionState.GRANTED) {
      requestPermissionForAlias("storage", call, "storagePermissionCallback");
      return;
    }

    write(call, fileName, data);
  }

  @PluginMethod
  public void storagePermissionCallback(PluginCall call) {
    if (getPermissionState("storage") != PermissionState.GRANTED) {
      call.reject("storage permission denied", "STORAGE_PERMISSION_DENIED");
      return;
    }
    String fileName = call.getString("fileName");
    String data = call.getString("data");
    if (fileName == null || data == null) {
      call.reject("fileName and data are required");
      return;
    }
    write(call, fileName, data);
  }

  private void write(PluginCall call, String fileName, String data) {
    String safe = sanitize(fileName);
    byte[] bytes = data.getBytes(StandardCharsets.UTF_8);
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, safe);
        values.put(MediaStore.Downloads.MIME_TYPE, MIME_JSON);
        values.put(MediaStore.Downloads.IS_PENDING, 1);
        Uri collection =
            MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri uri = getContext().getContentResolver().insert(collection, values);
        if (uri == null) {
          call.reject("could not create download entry");
          return;
        }
        try (OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
          if (os == null) {
            call.reject("could not open download stream");
            return;
          }
          os.write(bytes);
        }
        values.clear();
        values.put(MediaStore.Downloads.IS_PENDING, 0);
        getContext().getContentResolver().update(uri, values, null, null);
        JSObject ret = new JSObject();
        ret.put("path", "Download/" + safe);
        call.resolve(ret);
      } else {
        File dir =
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!dir.exists() && !dir.mkdirs()) {
          call.reject("could not create Downloads folder");
          return;
        }
        File out = new File(dir, safe);
        try (FileOutputStream fos = new FileOutputStream(out)) {
          fos.write(bytes);
        }
        JSObject ret = new JSObject();
        ret.put("path", out.getAbsolutePath());
        call.resolve(ret);
      }
    } catch (Exception e) {
      call.reject("download failed: " + e.getMessage(), e);
    }
  }

  private String sanitize(String name) {
    String n = name.replaceAll("[^A-Za-z0-9._-]", "_");
    if (n.isEmpty()) n = "tempo-history.json";
    if (!n.toLowerCase().endsWith(".json")) n += ".json";
    return n;
  }
}
