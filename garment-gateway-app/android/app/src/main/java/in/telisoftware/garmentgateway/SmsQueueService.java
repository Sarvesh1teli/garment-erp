package in.telisoftware.garmentgateway;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.telephony.SmsManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

public class SmsQueueService extends Service {
    public static final String ACTION_START = "in.telisoftware.garmentgateway.START_QUEUE";
    public static final String ACTION_STOP = "in.telisoftware.garmentgateway.STOP_QUEUE";
    private static final String CHANNEL_ID = "teli_gateway_sms_queue";
    private static final int NOTIFICATION_ID = 4102;
    private static final long EMPTY_POLL_MS = 5000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean active;
    private String token;
    private String apiUrl;
    private int delaySeconds;
    private int batchLimit;
    private int pauseAfter;
    private int pauseSeconds;
    private int sentInBatch;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopQueue();
            return START_NOT_STICKY;
        }
        if (intent != null && ACTION_START.equals(intent.getAction())) {
            token = intent.getStringExtra("token");
            apiUrl = trimSlash(intent.getStringExtra("apiUrl"));
            delaySeconds = Math.max(3, intent.getIntExtra("delaySeconds", 5));
            batchLimit = Math.max(1, intent.getIntExtra("batchLimit", 300));
            pauseAfter = Math.max(0, intent.getIntExtra("pauseAfter", 50));
            pauseSeconds = Math.max(0, intent.getIntExtra("pauseSeconds", 120));
            active = true;
            startForeground(NOTIFICATION_ID, notification("Waiting for pending SMS"));
            handler.removeCallbacks(pollRunnable);
            handler.post(pollRunnable);
        }
        return START_REDELIVER_INTENT;
    }

    private final Runnable pollRunnable = () -> {
        if (!active) return;
        executor.execute(this::pollAndSend);
    };

    private void pollAndSend() {
        long nextDelay = EMPTY_POLL_MS;
        try {
            JSONArray jobs = getJobs();
            if (jobs.length() > 0) {
                JSONObject job = jobs.getJSONObject(0);
                String jobId = job.optString("id");
                String phone = first(job, "recipientPhone", "recipient_phone");
                String message = job.optString("message");
                updateNotification("Sending SMS to " + phone);
                // Persist submission intent before touching the SIM. Never resend an
                // uncertain job after a lost cloud acknowledgement or process restart.
                android.content.SharedPreferences journal = getSharedPreferences("billing_sms_journal", MODE_PRIVATE);
                if (journal.contains(jobId)) {
                    updateStatus(jobId, "UNKNOWN", "Previously attempted on this phone; review before resending");
                } else {
                    if (!journal.edit().putBoolean(jobId, true).commit()) {
                        throw new IllegalStateException("Cannot persist SMS submission journal");
                    }
                    try {
                        sendSms(phone, message);
                    } catch (Exception sendError) {
                        updateStatus(jobId, "UNKNOWN", "SIM submission uncertain; review before resending");
                        throw sendError;
                    }
                    updateStatus(jobId, "SUBMITTED", null);
                    sentInBatch++;
                    updateNotification("SMS submitted to SIM. Waiting for next job");
                }
                nextDelay = delaySeconds * 1000L;
                if (sentInBatch >= batchLimit) {
                    active = false;
                    updateNotification("Batch limit reached. Open Teli Garment Gateway to restart");
                    return;
                }
                if (pauseAfter > 0 && sentInBatch > 0 && sentInBatch % pauseAfter == 0) {
                    nextDelay = pauseSeconds * 1000L;
                    updateNotification("Batch pause active");
                }
            } else {
                updateNotification("Waiting for pending SMS");
            }
        } catch (Exception error) {
            updateNotification("Cloud unavailable. Retrying automatically");
        }
        if (active) handler.postDelayed(pollRunnable, Math.max(nextDelay, 3000L));
    }

    private JSONArray getJobs() throws Exception {
        Object response = request("/api/v1/gateway/jobs?limit=1", "GET", null);
        return response instanceof JSONArray ? (JSONArray) response : new JSONArray();
    }

    private void updateStatus(String jobId, String status, @Nullable String error) throws Exception {
        JSONObject body = new JSONObject().put("status", status);
        if (error != null && !error.isBlank()) body.put("errorMessage", error);
        request("/api/v1/gateway/jobs/" + jobId + "/status", "POST", body.toString());
    }

    private Object request(String path, String method, @Nullable String body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(apiUrl + path).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Content-Type", "application/json");
        if (body != null) {
            connection.setDoOutput(true);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
        }
        int code = connection.getResponseCode();
        String response = read(code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream());
        connection.disconnect();
        if (code < 200 || code >= 300) throw new IllegalStateException("Request failed (" + code + ")");
        String trimmed = response.trim();
        return trimmed.startsWith("[") ? new JSONArray(trimmed) : new JSONObject(trimmed.isEmpty() ? "{}" : trimmed);
    }

    private void sendSms(String phone, String message) {
        String to = phone == null ? "" : phone.replaceAll("[^0-9+]", "");
        if (to.length() < 10 || message == null || message.isBlank()) {
            throw new IllegalArgumentException("Valid phone and message are required");
        }
        SmsManager sms = SmsManager.getDefault();
        ArrayList<String> parts = sms.divideMessage(message);
        if (parts.size() == 1) sms.sendTextMessage(to, null, parts.get(0), null, null);
        else sms.sendMultipartTextMessage(to, null, parts, null, null);
    }

    private String first(JSONObject object, String camel, String snake) {
        String value = object.optString(camel);
        return value.isBlank() ? object.optString(snake) : value;
    }

    private String read(@Nullable InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder result = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) result.append(line);
        }
        return result.toString();
    }

    private void stopQueue() {
        active = false;
        handler.removeCallbacksAndMessages(null);
        stopForeground(true);
        stopSelf();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Teli Garment Gateway SMS", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Keeps the SIM SMS queue active in the background");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private Notification notification(String text) {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setContentTitle("Teli Garment Gateway is active")
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(pendingIntent)
            .build();
    }

    private void updateNotification(String text) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(NOTIFICATION_ID, notification(text));
    }

    private String trimSlash(String value) {
        if (value == null) return "";
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        active = false;
        handler.removeCallbacksAndMessages(null);
        executor.shutdownNow();
        super.onDestroy();
    }
}
