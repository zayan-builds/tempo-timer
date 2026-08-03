package com.zayan.tempo;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(DownloadsPlugin.class);
    registerPlugin(JsonPickerPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
