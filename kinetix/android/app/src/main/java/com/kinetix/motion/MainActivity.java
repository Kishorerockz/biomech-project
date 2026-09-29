package com.kinetix.motion;

import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bindProcessToWiFi();
    }

    private void bindProcessToWiFi() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            if (cm == null) return;

            // Specifically request Wi-Fi WITHOUT requiring INTERNET capability
            // By default, NetworkRequest requires INTERNET; omitting it allows binding to local-only APs like ESP32
            NetworkRequest request = new NetworkRequest.Builder()
                .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build();

            // First: immediately check if Wi-Fi is already active and bind to it
            for (Network net : cm.getAllNetworks()) {
                NetworkCapabilities caps = cm.getNetworkCapabilities(net);
                if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                    cm.bindProcessToNetwork(net);
                    break;
                }
            }

            // Second: register callback to bind whenever Wi-Fi connects/reconnects
            cm.registerNetworkCallback(request, new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    try {
                        cm.bindProcessToNetwork(network);
                    } catch (Exception ignored) {}
                }

                @Override
                public void onLost(Network network) {
                    try {
                        cm.bindProcessToNetwork(null);
                    } catch (Exception ignored) {}
                }
            });
        } catch (Exception ignored) {}
    }
}
