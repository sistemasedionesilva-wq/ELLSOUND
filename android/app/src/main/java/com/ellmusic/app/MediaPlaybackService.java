package com.ellmusic.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import androidx.media.session.MediaSessionCompat;
import androidx.media.session.PlaybackStateCompat;
import androidx.media.MediaMetadataCompat;

public class MediaPlaybackService extends Service {

    private static final String CHANNEL_ID = "ellmusic_playback";
    private static final int NOTIFICATION_ID = 1;
    
    private MediaSessionCompat mediaSession;
    private NotificationManager notificationManager;

    @Override
    public void onCreate() {
        super.onCreate();
        
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        
        createNotificationChannel();
        initMediaSession();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "ELL MUSIC Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Notificação de reprodução de música em background");
            channel.setSound(null, null);
            notificationManager.createNotificationChannel(channel);
        }
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "ELLMusicSession");
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        
        mediaSession.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            )
            .setState(PlaybackStateCompat.STATE_PLAYING, 0, 1.0f)
            .build());

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                sendBroadcast(new Intent("ELL_MUSIC_PLAY"));
            }

            @Override
            public void onPause() {
                sendBroadcast(new Intent("ELL_MUSIC_PAUSE"));
            }

            @Override
            public void onSkipToNext() {
                sendBroadcast(new Intent("ELL_MUSIC_NEXT"));
            }

            @Override
            public void onSkipToPrevious() {
                sendBroadcast(new Intent("ELL_MUSIC_PREVIOUS"));
            }
        });

        mediaSession.setActive(true);
    }

    private Notification createNotification(String title, String artist, Bitmap artwork) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title)
            .setContentText(artist)
            .setLargeIcon(artwork != null ? artwork : getDefaultArtwork())
            .setContentIntent(pendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setOngoing(true)
            .setShowWhen(false);

        // Add media controls
        builder.addAction(new NotificationCompat.Action(
            android.R.drawable.ic_media_previous, "Anterior",
            PendingIntent.getBroadcast(this, 0, new Intent("ELL_MUSIC_PREVIOUS"), PendingIntent.FLAG_IMMUTABLE)));
        builder.addAction(new NotificationCompat.Action(
            android.R.drawable.ic_media_pause, "Pausar",
            PendingIntent.getBroadcast(this, 0, new Intent("ELL_MUSIC_PAUSE"), PendingIntent.FLAG_IMMUTABLE)));
        builder.addAction(new NotificationCompat.Action(
            android.R.drawable.ic_media_next, "Próxima",
            PendingIntent.getBroadcast(this, 0, new Intent("ELL_MUSIC_NEXT"), PendingIntent.FLAG_IMMUTABLE)));

        // Media style for lock screen controls
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            builder.setStyle(new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2)
                .setShowCancelButton(false));
        }

        return builder.build();
    }

    private Bitmap getDefaultArtwork() {
        try {
            return BitmapFactory.decodeResource(getResources(), android.R.drawable.ic_media_play);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.getAction() != null) {
            String action = intent.getAction();
            switch (action) {
                case "ELL_MUSIC_PLAY":
                    updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
                    break;
                case "ELL_MUSIC_PAUSE":
                    updatePlaybackState(PlaybackStateCompat.STATE_PAUSED);
                    break;
                case "ELL_MUSIC_NEXT":
                    sendBroadcast(new Intent("ELL_MUSIC_NEXT"));
                    break;
                case "ELL_MUSIC_PREVIOUS":
                    sendBroadcast(new Intent("ELL_MUSIC_PREVIOUS"));
                    break;
                case "ELL_MUSIC_UPDATE_METADATA":
                    String title = intent.getStringExtra("title");
                    String artist = intent.getStringExtra("artist");
                    updateNotification(title, artist, null);
                    break;
            }
        }
        return START_STICKY;
    }

    private void updatePlaybackState(int state) {
        if (mediaSession != null) {
            mediaSession.setPlaybackState(new PlaybackStateCompat.Builder()
                .setActions(
                    PlaybackStateCompat.ACTION_PLAY |
                    PlaybackStateCompat.ACTION_PAUSE |
                    PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                    PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                )
                .setState(state, 0, 1.0f)
                .build());
        }
    }

    private void updateNotification(String title, String artist, String artworkUrl) {
        Notification notification = createNotification(title != null ? title : "ELL MUSIC", 
            artist != null ? artist : "Tocando agora", null);
        notificationManager.notify(NOTIFICATION_ID, notification);
        
        if (mediaSession != null) {
            MediaMetadataCompat.Builder metadataBuilder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title != null ? title : "ELL MUSIC")
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist != null ? artist : "Desconhecido");
            
            mediaSession.setMetadata(metadataBuilder.build());
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        notificationManager.cancel(NOTIFICATION_ID);
        super.onDestroy();
    }
}